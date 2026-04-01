/**
 * WebSocket handler for Real-Time Collaboration.
 *
 * Route: /ws/collab/:projectId
 *
 * Tracks connected users per project with presence, cursor sync,
 * live annotations, and segment editing locks.
 *
 * Messages received:
 *   - identify        — user identifies themselves on connect
 *   - cursor:move     — cursor position update (segment, timestamp)
 *   - annotation:create / annotation:update / annotation:delete
 *   - segment:lock    — request editing lock on a segment
 *   - segment:unlock  — release editing lock
 *   - heartbeat       — keep-alive ping (every 10s)
 *
 * Messages sent:
 *   - presence:state  — full presence state on connect
 *   - user:joined     — new user connected
 *   - user:left       — user disconnected
 *   - cursor:moved    — another user's cursor position
 *   - annotation:created / annotation:updated / annotation:deleted
 *   - segment:locked  — segment locked by a user
 *   - segment:unlocked — segment unlocked
 *   - pong            — heartbeat response
 *   - error           — error message
 */

import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';

// ─── Types ──────────────────────────────────────────────────────────

const USER_COLORS = [
  '#E74C3C', '#3498DB', '#2ECC71', '#F1C40F', '#9B59B6',
  '#1ABC9C', '#E67E22', '#E91E63', '#00BCD4', '#8BC34A',
  '#FF5722', '#607D8B', '#673AB7', '#009688', '#FF9800',
] as const;

export interface CollabUser {
  userId: string;
  clientId: string;
  name: string;
  role: string;
  color: string;
  cursor: {
    segmentId: string | null;
    timestamp: number | null;
  };
  lastSeen: number;
}

interface SegmentLock {
  segmentId: string;
  userId: string;
  clientId: string;
  lockedAt: number;
  version: number;
}

interface ProjectCollabState {
  users: Map<string, CollabUser>;       // clientId -> user
  sockets: Map<string, WebSocket>;      // clientId -> socket
  locks: Map<string, SegmentLock>;      // segmentId -> lock
  colorIndex: number;
}

// ─── State ──────────────────────────────────────────────────────────

// projectId -> collaboration state
const projectStates = new Map<string, ProjectCollabState>();

// Heartbeat tracking — remove users after 30s of silence
const HEARTBEAT_TIMEOUT_MS = 30_000;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

function getOrCreateState(projectId: string): ProjectCollabState {
  let state = projectStates.get(projectId);
  if (!state) {
    state = {
      users: new Map(),
      sockets: new Map(),
      locks: new Map(),
      colorIndex: 0,
    };
    projectStates.set(projectId, state);
  }
  return state;
}

function assignColor(state: ProjectCollabState): string {
  const color = USER_COLORS[state.colorIndex % USER_COLORS.length];
  state.colorIndex++;
  return color;
}

function broadcast(state: ProjectCollabState, message: unknown, excludeClientId?: string): void {
  const payload = JSON.stringify(message);
  for (const [clientId, socket] of state.sockets) {
    if (clientId === excludeClientId) continue;
    try {
      if (socket.readyState === 1 /* OPEN */) {
        socket.send(payload);
      }
    } catch {
      // Dead socket — will be cleaned up by heartbeat
    }
  }
}

function broadcastAll(state: ProjectCollabState, message: unknown): void {
  broadcast(state, message);
}

function removeUser(projectId: string, clientId: string): void {
  const state = projectStates.get(projectId);
  if (!state) return;

  const user = state.users.get(clientId);
  state.users.delete(clientId);
  state.sockets.delete(clientId);

  // Release any locks held by this user
  for (const [segmentId, lock] of state.locks) {
    if (lock.clientId === clientId) {
      state.locks.delete(segmentId);
      broadcast(state, {
        type: 'segment:unlocked',
        payload: { segmentId, userId: lock.userId },
        timestamp: Date.now(),
      });
    }
  }

  // Notify others
  if (user) {
    broadcast(state, {
      type: 'user:left',
      payload: {
        userId: user.userId,
        clientId,
        name: user.name,
      },
      timestamp: Date.now(),
    });
  }

  // Clean up empty project states
  if (state.users.size === 0) {
    projectStates.delete(projectId);
  }
}

// ─── Heartbeat sweep ────────────────────────────────────────────────

function startHeartbeatSweep(): void {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(() => {
    const now = Date.now();
    for (const [projectId, state] of projectStates) {
      for (const [clientId, user] of state.users) {
        if (now - user.lastSeen > HEARTBEAT_TIMEOUT_MS) {
          console.log(`[ws:collab] Heartbeat timeout for ${user.name} (${clientId})`);
          const socket = state.sockets.get(clientId);
          if (socket) {
            try { socket.close(4000, 'Heartbeat timeout'); } catch { /* ignore */ }
          }
          removeUser(projectId, clientId);
        }
      }
    }
  }, 10_000);
}

function stopHeartbeatSweep(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ─── Public API for annotation service to broadcast events ──────────

export function broadcastAnnotationEvent(
  projectId: string,
  eventType: 'annotation:created' | 'annotation:updated' | 'annotation:deleted',
  payload: unknown,
  excludeClientId?: string,
): void {
  const state = projectStates.get(projectId);
  if (!state) return;
  broadcast(state, {
    type: eventType,
    payload,
    timestamp: Date.now(),
  }, excludeClientId);
}

/**
 * Get the list of currently connected collaboration users for a project.
 */
export function getCollabUsers(projectId: string): CollabUser[] {
  const state = projectStates.get(projectId);
  if (!state) return [];
  return Array.from(state.users.values());
}

/**
 * Get current segment locks for a project.
 */
export function getSegmentLocks(projectId: string): SegmentLock[] {
  const state = projectStates.get(projectId);
  if (!state) return [];
  return Array.from(state.locks.values());
}

// ─── Register WebSocket route ───────────────────────────────────────

export async function registerCollabWS(app: FastifyInstance): Promise<void> {
  startHeartbeatSweep();

  app.get('/ws/collab/:projectId', { websocket: true }, (socket: WebSocket, req) => {
    const projectId = (req.params as { projectId: string }).projectId;
    const clientId = uuid();
    const state = getOrCreateState(projectId);

    console.log(`[ws:collab] Client connected: ${clientId} for project ${projectId}`);

    // Create a placeholder user until they identify
    const placeholderUser: CollabUser = {
      userId: clientId,
      clientId,
      name: 'Anonymous',
      role: 'viewer',
      color: assignColor(state),
      cursor: { segmentId: null, timestamp: null },
      lastSeen: Date.now(),
    };

    state.users.set(clientId, placeholderUser);
    state.sockets.set(clientId, socket);

    // Send current presence state to the new user
    socket.send(JSON.stringify({
      type: 'presence:state',
      payload: {
        clientId,
        assignedColor: placeholderUser.color,
        users: Array.from(state.users.values()),
        locks: Array.from(state.locks.values()),
      },
      timestamp: Date.now(),
    }));

    // Handle messages
    socket.on('message', async (raw: Buffer | string) => {
      try {
        const message = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
        const user = state.users.get(clientId);
        if (user) user.lastSeen = Date.now();

        switch (message.type) {
          // ── Identify ──────────────────────────────────────────
          case 'identify': {
            const { userId, name, role } = message.payload ?? {};
            if (user) {
              user.userId = userId ?? user.userId;
              user.name = name ?? user.name;
              user.role = role ?? user.role;
            }

            // Broadcast join to others
            broadcast(state, {
              type: 'user:joined',
              payload: {
                userId: user?.userId,
                clientId,
                name: user?.name,
                role: user?.role,
                color: user?.color,
              },
              timestamp: Date.now(),
            }, clientId);
            // Send presence state to the new client
            socket.send(JSON.stringify({
              type: 'presence:state',
              payload: {
                clientId,
                assignedColor: user?.color,
                users: Array.from(state.users.values()),
                locks: Array.from(state.locks.values()),
              },
              timestamp: Date.now(),
            }));
            break;
          }

          // ── Cursor sync ───────────────────────────────────────
          case 'cursor:move': {
            const { segmentId, timestamp: cursorTs } = message.payload ?? {};
            if (user) {
              user.cursor = {
                segmentId: segmentId ?? null,
                timestamp: cursorTs ?? null,
              };
            }

            broadcast(state, {
              type: 'cursor:moved',
              payload: {
                userId: user?.userId,
                clientId,
                name: user?.name,
                color: user?.color,
                segmentId,
                timestamp: cursorTs,
              },
              timestamp: Date.now(),
            }, clientId);
            break;
          }

          // ── Segment lock ──────────────────────────────────────
          case 'segment:lock': {
            const { segmentId } = message.payload ?? {};
            if (!segmentId) break;

            const existingLock = state.locks.get(segmentId);
            if (existingLock && existingLock.clientId !== clientId) {
              // Already locked by someone else
              socket.send(JSON.stringify({
                type: 'error',
                payload: {
                  code: 'SEGMENT_LOCKED',
                  message: `Segment is locked by ${existingLock.userId}`,
                  segmentId,
                  lockedBy: existingLock.userId,
                },
                timestamp: Date.now(),
              }));
              break;
            }

            const lock: SegmentLock = {
              segmentId,
              userId: user?.userId ?? clientId,
              clientId,
              lockedAt: Date.now(),
              version: (existingLock?.version ?? 0) + 1,
            };
            state.locks.set(segmentId, lock);

            broadcastAll(state, {
              type: 'segment:locked',
              payload: lock,
              timestamp: Date.now(),
            });
            break;
          }

          // ── Segment unlock ────────────────────────────────────
          case 'segment:unlock': {
            const { segmentId } = message.payload ?? {};
            if (!segmentId) break;

            const existingLock = state.locks.get(segmentId);
            if (existingLock && existingLock.clientId !== clientId) {
              // Can't unlock someone else's lock (unless admin)
              if (user?.role !== 'admin') {
                socket.send(JSON.stringify({
                  type: 'error',
                  payload: {
                    code: 'LOCK_NOT_OWNED',
                    message: 'You do not own this lock',
                    segmentId,
                  },
                  timestamp: Date.now(),
                }));
                break;
              }
            }

            state.locks.delete(segmentId);

            broadcastAll(state, {
              type: 'segment:unlocked',
              payload: {
                segmentId,
                userId: user?.userId ?? clientId,
              },
              timestamp: Date.now(),
            });
            break;
          }

          // ── Annotation events (relayed from REST or direct) ───
          case 'annotation:create':
          case 'annotation:update':
          case 'annotation:delete': {
            // These are typically triggered via REST and broadcast
            // by the annotation service. But support direct WS relay too.
            const eventType = message.type.replace('annotation:', 'annotation:') as
              'annotation:created' | 'annotation:updated' | 'annotation:deleted';
            const mappedType = eventType.endsWith('e')
              ? eventType + 'd'
              : eventType;

            broadcast(state, {
              type: mappedType,
              payload: {
                ...message.payload,
                userId: user?.userId ?? clientId,
                color: user?.color,
              },
              timestamp: Date.now(),
            }, clientId);
            break;
          }

          // ── Heartbeat ─────────────────────────────────────────
          case 'heartbeat': {
            socket.send(JSON.stringify({
              type: 'pong',
              timestamp: Date.now(),
            }));
            break;
          }

          default: {
            socket.send(JSON.stringify({
              type: 'error',
              payload: { message: `Unknown message type: ${message.type}` },
              timestamp: Date.now(),
            }));
          }
        }
      } catch (err) {
        console.error('[ws:collab] Message handling error:', err);
        socket.send(JSON.stringify({
          type: 'error',
          payload: { message: (err as Error).message },
          timestamp: Date.now(),
        }));
      }
    });

    // Handle disconnect
    socket.on('close', () => {
      console.log(`[ws:collab] Client disconnected: ${clientId}`);
      removeUser(projectId, clientId);
    });

    socket.on('error', (err: Error) => {
      console.error(`[ws:collab] Socket error for ${clientId}:`, err.message);
      removeUser(projectId, clientId);
    });
  });

  // Cleanup on server close
  app.addHook('onClose', async () => {
    stopHeartbeatSweep();
    projectStates.clear();
  });
}
