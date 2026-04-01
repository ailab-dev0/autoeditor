/**
 * WebSocket handler for Premiere Pro plugin connections.
 *
 * Route: /ws/premiere/:projectId
 *
 * Receives:
 *   - analyze_request: start analysis pipeline
 *   - segment_update: segment approval/rejection from plugin
 *   - heartbeat: keep-alive ping
 *
 * Sends:
 *   - analyze_response: pipeline progress updates
 *   - edit_package: completed analysis results
 *   - segment_update: segment changes synced from dashboard
 *   - pipeline_status: pipeline stage updates
 *   - pong: heartbeat response
 */

import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';
import { syncManager } from './sync.js';
import { processSegmentUpdate } from '../services/sync-service.js';
import { getProjectById } from '../services/project-service.js';
import { startPipeline } from '../services/analysis-service.js';
import type { WSSegmentUpdate, WSAnalyzeRequest } from '../types/index.js';

export async function registerPremiereWS(app: FastifyInstance): Promise<void> {
  app.get('/ws/premiere/:projectId', { websocket: true }, (socket: WebSocket, req) => {
    const projectId = (req.params as { projectId: string }).projectId;
    const clientId = uuid();

    console.log(`[ws:premiere] Plugin connected: ${clientId} for project ${projectId}`);

    // Register with sync manager
    const client = syncManager.registerClient(clientId, 'plugin', projectId, socket);

    // Send connection confirmation
    socket.send(JSON.stringify({
      type: 'connected',
      payload: { clientId, projectId, clientType: 'plugin' },
    }));

    // Handle incoming messages
    socket.on('message', async (raw: Buffer | string) => {
      try {
        const message = JSON.parse(typeof raw === 'string' ? raw : raw.toString());

        switch (message.type) {
          case 'analyze_request': {
            await handleAnalyzeRequest(projectId, message.payload, socket);
            break;
          }

          case 'segment_update': {
            const update: WSSegmentUpdate = {
              segmentId: message.payload.segmentId,
              approved: message.payload.approved,
              override: message.payload.override ?? null,
              timestamp: message.payload.timestamp ?? Date.now(),
              source: 'plugin',
            };

            const segment = await processSegmentUpdate(projectId, update, 'plugin');

            if (segment) {
              // Confirm back to the originator
              socket.send(JSON.stringify({
                type: 'segment_update_ack',
                payload: { segmentId: update.segmentId, success: true },
              }));
            }
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
            console.warn(`[ws:premiere] Unknown message type: ${message.type}`);
            socket.send(JSON.stringify({
              type: 'error',
              payload: { message: `Unknown message type: ${message.type}` },
            }));
          }
        }
      } catch (err) {
        console.error('[ws:premiere] Message handling error:', err);
        socket.send(JSON.stringify({
          type: 'error',
          payload: { message: (err as Error).message },
        }));
      }
    });

    // Handle disconnect
    socket.on('close', () => {
      console.log(`[ws:premiere] Plugin disconnected: ${clientId}`);
      syncManager.unregisterClient(client);
    });

    socket.on('error', (err: Error) => {
      console.error(`[ws:premiere] Socket error for ${clientId}:`, err);
      syncManager.unregisterClient(client);
    });
  });
}

/**
 * Handle analyze_request from the plugin.
 */
async function handleAnalyzeRequest(
  projectId: string,
  payload: WSAnalyzeRequest,
  socket: WebSocket
): Promise<void> {
  const project = await getProjectById(projectId);

  if (!project) {
    socket.send(JSON.stringify({
      type: 'error',
      payload: { message: `Project not found: ${projectId}` },
    }));
    return;
  }

  try {
    // Update project with any new info from the plugin
    if (payload.brief) {
      project.brief = payload.brief;
    }

    // Start the pipeline
    const status = await startPipeline(project);

    socket.send(JSON.stringify({
      type: 'analyze_response',
      payload: {
        stage: status.current_stage,
        percentage: 0,
        message: 'Pipeline started',
        session_id: status.session_id,
      },
    }));
  } catch (err) {
    socket.send(JSON.stringify({
      type: 'error',
      payload: { message: (err as Error).message },
    }));
  }
}
