/**
 * Role-Based Access Control middleware factory.
 *
 * Usage:
 *   app.post('/api/projects', { preHandler: [authenticate, requireRole('editor', 'producer')] }, handler)
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UserRole } from './auth.js';

/**
 * Returns a Fastify preHandler that checks `req.user.role` against the
 * provided whitelist.  Returns 403 if the role is not authorized.
 *
 * Must be used AFTER the `authenticate` middleware so that `req.user`
 * is already populated.
 */
export function requireRole(...roles: UserRole[]) {
  return async function checkRole(
    req: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!req.user) {
      reply.status(401).send({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      reply.status(403).send({
        error: 'Forbidden',
        message: `Role '${req.user.role}' is not authorized for this action. Required: ${roles.join(', ')}`,
      });
    }
  };
}
