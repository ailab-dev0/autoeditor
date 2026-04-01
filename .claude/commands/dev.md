Start development servers for $ARGUMENTS (or all services if no argument).

Valid targets: `dashboard`, `backend`, `remotion`, `all`

Run the appropriate dev commands:
- **dashboard**: `cd mk12-dashboard && npm run dev` (port 3000)
- **backend**: `cd mk12-backend && npm run dev` (port 8000)
- **remotion**: `cd mk12-animation-engine && npm run dev` (port 4200)
- **all**: Start all three in parallel using background processes

Use `run_in_background` for long-running dev servers. Report which services started and on which ports.
