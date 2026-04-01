# Testing Rules

## UAT Structure
```
mk12-uat/
├── plugin/       — node:test, 203 tests (mocks: localStorage, premierepro, DOM, WebSocket)
├── backend/      — vitest, 132 tests (spawns real backend, tests API + WebSocket + SSE)
├── dashboard/    — vitest + happy-dom + MSW, 191 tests (hooks, components, pages)
├── animation/    — vitest, 120 tests (router, queue, templates, API)
└── integration/  — vitest, 30 tests (cross-service sync, approval flow, full pipeline)
```

## Plugin Tests (node:test)
- Mocks: `mocks/localStorage.js`, `mocks/premierepro.js`, `mocks/dom.js`, `mocks/websocket.js`
- All ESM imports. Uses `node --test tests/*.test.js`
- Core tests + component tests + e2e workflow simulation

## Backend Tests (vitest)
- `setup.ts` spawns backend as child process on random port
- Tests hit real HTTP endpoints and WebSocket connections
- Sequential execution (tests share server state)
- 30s timeout per test

## Dashboard Tests (vitest + happy-dom)
- MSW handlers intercept `http://localhost:8000/api/*` (must use full URL, not relative)
- `setup.ts` installs MockWebSocket globally (overrides happy-dom's)
- Runtime handler overrides in tests need full BASE URL prefix
- TanStack Query hooks need `createWrapper()` with QueryClientProvider

## Animation Tests (vitest)
- Tests the routing logic and queue, NOT actual Remotion rendering
- Content mark router tests must match the actual keyword→template mapping

## Running All Tests
```bash
make test  # or manually:
cd mk12-uat/backend && npx vitest run
cd mk12-uat/dashboard && npx vitest run
cd mk12-uat/animation && npx vitest run
cd mk12-uat/integration && npx vitest run
cd mk12-uat/plugin && node --test tests/*.test.js
cd mk12-premiere-plugin && node --test test/*.test.js
```

Total: 779 tests, 0 failures expected.
