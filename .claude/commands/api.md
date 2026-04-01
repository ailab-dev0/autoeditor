Create or modify a backend API route.

Arguments: $ARGUMENTS should describe the endpoint (e.g., "GET /api/projects/:id/segments", "add pagination to segments endpoint").

Steps:
1. Check existing routes in `mk12-backend/src/` for patterns and conventions
2. Follow the existing Fastify route registration pattern
3. Use Zod schemas for request/response validation
4. Add proper TypeScript types
5. If modifying an existing route, read it first before making changes
6. Update any relevant type definitions shared with the dashboard
