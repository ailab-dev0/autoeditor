/**
 * JWT Authentication middleware.
 *
 * Extracts and verifies a Bearer token from the Authorization header,
 * then attaches the decoded user payload to the request.
 */

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

export type UserRole =
  | 'editor'
  | 'visualizer'
  | 'content_specialist'
  | 'creative_director'
  | 'producer';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

// Extend FastifyRequest so downstream handlers can access req.user
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

// ──────────────────────────────────────────────────────────────────
// Middleware
// ──────────────────────────────────────────────────────────────────

/**
 * Fastify preHandler hook that validates the JWT from the
 * `Authorization: Bearer <token>` header and attaches `req.user`.
 *
 * Returns 401 if the token is missing, malformed, or invalid.
 */
export async function authenticate(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = req.headers.authorization;
  const queryToken = (req.query as Record<string, string>)?.token;

  // Accept token from Authorization header OR ?token= query param (for <video>, SSE, WebSocket)
  let token: string | undefined;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (queryToken) {
    token = queryToken;
  }

  if (!token) {
    reply.status(401).send({ error: 'Missing or malformed Authorization header' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthUser & { iat?: number; exp?: number };
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };
  } catch (err) {
    const message =
      (err as Error).name === 'TokenExpiredError'
        ? 'Token expired'
        : 'Invalid token';
    reply.status(401).send({ error: message });
  }
}
