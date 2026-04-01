/**
 * Authentication routes.
 *
 * POST /api/auth/login       — login with email + password, returns JWT
 * POST /api/auth/register    — create user, returns JWT
 * GET  /api/auth/me          — return current user from token
 * POST /api/auth/refresh     — refresh token (extend expiry)
 * POST /api/auth/dev-token   — create a token with any role (dev only)
 *
 * Users are stored in Postgres (Neon):
 *   users (id, email, name, role, password_hash, created_at, updated_at)
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { query as pgQuery } from '../db/postgres.js';
import { authenticate } from '../middleware/auth.js';
import type { UserRole } from '../middleware/auth.js';

// ──────────────────────────────────────────────────────────────────
// Schemas
// ──────────────────────────────────────────────────────────────────

const VALID_ROLES: UserRole[] = [
  'editor',
  'visualizer',
  'content_specialist',
  'creative_director',
  'producer',
];

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(200),
  role: z.enum(VALID_ROLES as [UserRole, ...UserRole[]]).default('editor'),
});

const DevTokenSchema = z.object({
  email: z.string().email().default('dev@editorlens.local'),
  name: z.string().default('Dev User'),
  role: z.enum(VALID_ROLES as [UserRole, ...UserRole[]]).default('editor'),
});

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

const TOKEN_EXPIRY = '24h';
const REFRESH_EXPIRY = '7d';
const SALT_ROUNDS = 10;

function signToken(payload: { id: string; email: string; name: string; role: UserRole }, expiresIn: string = TOKEN_EXPIRY): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn } as jwt.SignOptions);
}

// ──────────────────────────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────────────────────────

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // ── Login ────────────────────────────────────────────────────────
  app.post('/api/auth/login', async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const { email, password } = parsed.data;

    const result = await pgQuery(
      'SELECT id, email, name, role, password_hash FROM users WHERE email = $1',
      [email],
    );

    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const user = result.rows[0] as { id: string; email: string; name: string; role: UserRole; password_hash: string };

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });
    const refreshToken = signToken({ id: user.id, email: user.email, name: user.name, role: user.role }, REFRESH_EXPIRY);

    return reply.send({
      token,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  });

  // ── Register ─────────────────────────────────────────────────────
  app.post('/api/auth/register', async (req, reply) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const { email, password, name, role } = parsed.data;

    // Check if user already exists
    const existing = await pgQuery(
      'SELECT id FROM users WHERE email = $1',
      [email],
    );

    if (existing.rows.length > 0) {
      return reply.status(409).send({ error: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const insertResult = await pgQuery(
      'INSERT INTO users (email, name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
      [email, name, role, passwordHash],
    );

    const newUser = insertResult.rows[0] as { id: string; email: string; name: string; role: UserRole };

    const token = signToken({ id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role });
    const refreshToken = signToken({ id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role }, REFRESH_EXPIRY);

    return reply.status(201).send({
      token,
      refreshToken,
      user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
    });
  });

  // ── Me (requires auth) ──────────────────────────────────────────
  app.get('/api/auth/me', { preHandler: [authenticate] }, async (req, reply) => {
    return reply.send({ user: req.user });
  });

  // ── Refresh Token ────────────────────────────────────────────────
  app.post('/api/auth/refresh', async (req, reply) => {
    const body = req.body as { refreshToken?: string } | undefined;
    const refreshToken = body?.refreshToken;

    if (!refreshToken) {
      return reply.status(400).send({ error: 'refreshToken is required' });
    }

    try {
      const decoded = jwt.verify(refreshToken, config.jwtSecret) as {
        id: string;
        email: string;
        name: string;
        role: UserRole;
      };

      // Re-fetch user from Postgres to ensure they still exist and have the right role
      const result = await pgQuery(
        'SELECT id, email, name, role FROM users WHERE id = $1',
        [decoded.id],
      );

      if (result.rows.length === 0) {
        return reply.status(401).send({ error: 'User no longer exists' });
      }

      const user = result.rows[0] as { id: string; email: string; name: string; role: UserRole };

      const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });
      const newRefreshToken = signToken({ id: user.id, email: user.email, name: user.name, role: user.role }, REFRESH_EXPIRY);

      return reply.send({ token, refreshToken: newRefreshToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired refresh token' });
    }
  });

  // ── Dev Token (development only) ─────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    app.post('/api/auth/dev-token', async (req, reply) => {
      const parsed = DevTokenSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
      }

      const { email, name, role } = parsed.data;

      // Find or create user in Postgres so foreign keys work
      let userId: string;
      const existing = await pgQuery('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        userId = existing.rows[0].id;
      } else {
        const hash = await bcrypt.hash('dev-password', 4);
        const created = await pgQuery(
          'INSERT INTO users (email, name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id',
          [email, name, role, hash],
        );
        userId = created.rows[0].id;
      }

      const token = signToken({ id: userId, email, name, role });

      return reply.send({
        token,
        user: { id: userId, email, name, role },
        _warning: 'Dev token — no password verification. Do NOT use in production.',
      });
    });
  }
}
