/**
 * SyncManager — real-time approval sync across all connected clients.
 *
 * Tracks WebSocket connections per project (plugin + dashboard).
 * When any client approves/rejects a segment, broadcasts to ALL
 * other connected clients. Prevents echo loops by excluding the
 * originator from the broadcast.
 */

import type { WebSocket } from 'ws';
import type { ClientType, WSSegmentUpdate, PipelineStatus } from '../types/index.js';
import { onSegmentUpdate, onPipelineStatus } from '../services/sync-service.js';

interface RegisteredClient {
  id: string;
  type: ClientType;
  projectId: string;
  socket: WebSocket;
  connectedAt: string;
}

class SyncManager {
  // projectId -> Set of registered clients
  private clients = new Map<string, Set<RegisteredClient>>();

  // Cleanup functions for service listeners
  private unsubscribers: Array<() => void> = [];

  constructor() {
    // Listen for segment updates from the sync service
    this.unsubscribers.push(
      onSegmentUpdate((projectId, update, source) => {
        this.broadcastSegmentUpdate(projectId, update, source);
      })
    );

    // Listen for pipeline status updates
    this.unsubscribers.push(
      onPipelineStatus((projectId, status) => {
        this.broadcastPipelineStatus(projectId, status);
      })
    );
  }

  /**
   * Register a new WebSocket client.
   */
  registerClient(
    id: string,
    type: ClientType,
    projectId: string,
    socket: WebSocket
  ): RegisteredClient {
    if (!this.clients.has(projectId)) {
      this.clients.set(projectId, new Set());
    }

    const client: RegisteredClient = {
      id,
      type,
      projectId,
      socket,
      connectedAt: new Date().toISOString(),
    };

    this.clients.get(projectId)!.add(client);
    console.log(`[sync] Client registered: ${type} ${id} for project ${projectId} (${this.getClientCount(projectId)} total)`);

    return client;
  }

  /**
   * Unregister a client when they disconnect.
   */
  unregisterClient(client: RegisteredClient): void {
    const projectClients = this.clients.get(client.projectId);
    if (projectClients) {
      projectClients.delete(client);
      if (projectClients.size === 0) {
        this.clients.delete(client.projectId);
      }
    }
    console.log(`[sync] Client unregistered: ${client.type} ${client.id} for project ${client.projectId} (${this.getClientCount(client.projectId)} remaining)`);
  }

  /**
   * Broadcast a segment update to all clients except the originator.
   */
  broadcastSegmentUpdate(
    projectId: string,
    update: WSSegmentUpdate,
    sourceType: ClientType,
    excludeClientId?: string
  ): void {
    const projectClients = this.clients.get(projectId);
    if (!projectClients) return;

    const message = JSON.stringify({
      type: 'segment_update',
      payload: {
        segmentId: update.segmentId,
        approved: update.approved,
        override: update.override ?? null,
        source: sourceType,
        timestamp: Date.now(),
      },
    });

    for (const client of projectClients) {
      // Don't send back to originator (prevent echo loops)
      if (excludeClientId && client.id === excludeClientId) continue;

      this.safeSend(client, message);
    }
  }

  /**
   * Broadcast pipeline status to all clients for a project.
   */
  broadcastPipelineStatus(projectId: string, status: PipelineStatus): void {
    const projectClients = this.clients.get(projectId);
    if (!projectClients) return;

    const message = JSON.stringify({
      type: 'pipeline_status',
      payload: {
        stage: status.current_stage,
        percentage: status.overall_progress,
        stages: status.stages,
        error: status.error,
      },
    });

    for (const client of projectClients) {
      this.safeSend(client, message);
    }
  }

  /**
   * Send an edit package to all clients for a project.
   */
  broadcastEditPackage(projectId: string, editPackage: unknown): void {
    const projectClients = this.clients.get(projectId);
    if (!projectClients) return;

    const message = JSON.stringify({
      type: 'edit_package',
      payload: editPackage,
    });

    for (const client of projectClients) {
      this.safeSend(client, message);
    }
  }

  /**
   * Send a message safely to a client, handling closed connections.
   */
  private safeSend(client: RegisteredClient, message: string): void {
    try {
      if (client.socket.readyState === 1 /* OPEN */) {
        client.socket.send(message);
      }
    } catch (err) {
      console.warn(`[sync] Failed to send to ${client.type} ${client.id}:`, (err as Error).message);
      // Remove dead client
      this.unregisterClient(client);
    }
  }

  /**
   * Broadcast a raw message to all clients for a project, optionally excluding one.
   */
  broadcastRaw(projectId: string, message: unknown, excludeClientId?: string): void {
    const projectClients = this.clients.get(projectId);
    if (!projectClients) return;
    const json = JSON.stringify(message);
    for (const client of projectClients) {
      if (excludeClientId && client.id === excludeClientId) continue;
      this.safeSend(client, json);
    }
  }

  /**
   * Get the number of connected clients for a project.
   */
  getClientCount(projectId: string): number {
    return this.clients.get(projectId)?.size ?? 0;
  }

  /**
   * Get connected client info for a project.
   */
  getClients(projectId: string): Array<{ id: string; type: ClientType; connectedAt: string }> {
    const projectClients = this.clients.get(projectId);
    if (!projectClients) return [];

    return Array.from(projectClients).map((c) => ({
      id: c.id,
      type: c.type,
      connectedAt: c.connectedAt,
    }));
  }

  /**
   * Cleanup all listeners.
   */
  destroy(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.clients.clear();
  }
}

// Singleton instance
export const syncManager = new SyncManager();
