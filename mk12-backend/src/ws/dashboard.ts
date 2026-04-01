/**
 * WebSocket handler for Web Dashboard connections.
 *
 * Route: /ws/dashboard/:projectId
 *
 * Receives:
 *   - segment_update: approval/rejection from dashboard UI
 *   - heartbeat: keep-alive ping
 *
 * Sends:
 *   - segment_update: segment changes synced from plugin
 *   - pipeline_status: pipeline stage updates
 *   - edit_package: completed analysis results
 *   - pong: heartbeat response
 */

import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';
import { syncManager } from './sync.js';
import { processSegmentUpdate } from '../services/sync-service.js';
import { getProjectById } from '../services/project-service.js';
import { listSegments, getApprovalStats } from '../services/segment-service.js';
import type { WSSegmentUpdate } from '../types/index.js';

export async function registerDashboardWS(app: FastifyInstance): Promise<void> {
  app.get('/ws/dashboard/:projectId', { websocket: true }, (socket: WebSocket, req) => {
    const projectId = (req.params as { projectId: string }).projectId;
    const clientId = uuid();

    console.log(`[ws:dashboard] Dashboard connected: ${clientId} for project ${projectId}`);

    // Register with sync manager
    const client = syncManager.registerClient(clientId, 'dashboard', projectId, socket);

    // Send connection confirmation with current state (async init)
    (async () => {
      try {
        const project = await getProjectById(projectId);
        const segments = await listSegments(projectId);
        const approvalStats = await getApprovalStats(projectId);
        const connectedClients = syncManager.getClients(projectId);

        socket.send(JSON.stringify({
          type: 'connected',
          payload: {
            clientId,
            projectId,
            clientType: 'dashboard',
            project: project ?? null,
            segmentCount: segments.length,
            approvalStats,
            connectedClients,
          },
        }));
      } catch (err) {
        console.error('[ws:dashboard] Failed to send initial state:', (err as Error).message);
      }
    })();

    // Handle incoming messages
    socket.on('message', async (raw: Buffer | string) => {
      try {
        const message = JSON.parse(typeof raw === 'string' ? raw : raw.toString());

        switch (message.type) {
          case 'segment_update': {
            const update: WSSegmentUpdate = {
              segmentId: message.payload.segmentId,
              approved: message.payload.approved,
              override: message.payload.override ?? null,
              timestamp: message.payload.timestamp ?? Date.now(),
              source: 'dashboard',
            };

            const segment = await processSegmentUpdate(projectId, update, 'dashboard');

            if (segment) {
              // Confirm back to the originator
              socket.send(JSON.stringify({
                type: 'segment_update_ack',
                payload: {
                  segmentId: update.segmentId,
                  success: true,
                  approvalStats: await getApprovalStats(projectId),
                },
              }));
            }
            break;
          }

          case 'project_update': {
            // Forward to all other clients (plugin) for the same project
            syncManager.broadcastRaw(projectId, {
              type: 'project_update',
              payload: message.payload,
            }, clientId);
            break;
          }

          case 'heartbeat': {
            socket.send(JSON.stringify({
              type: 'pong',
              timestamp: Date.now(),
            }));
            break;
          }

          default: {
            console.warn(`[ws:dashboard] Unknown message type: ${message.type}`);
            socket.send(JSON.stringify({
              type: 'error',
              payload: { message: `Unknown message type: ${message.type}` },
            }));
          }
        }
      } catch (err) {
        console.error('[ws:dashboard] Message handling error:', err);
        socket.send(JSON.stringify({
          type: 'error',
          payload: { message: (err as Error).message },
        }));
      }
    });

    // Handle disconnect
    socket.on('close', () => {
      console.log(`[ws:dashboard] Dashboard disconnected: ${clientId}`);
      syncManager.unregisterClient(client);
    });

    socket.on('error', (err: Error) => {
      console.error(`[ws:dashboard] Socket error for ${clientId}:`, err);
      syncManager.unregisterClient(client);
    });
  });
}
