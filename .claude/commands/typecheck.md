Run TypeScript type checking on $ARGUMENTS (or all services if no argument).

Valid targets: `dashboard`, `backend`, `remotion`, `all`

Commands:
- **dashboard**: `cd mk12-dashboard && npx tsc --noEmit`
- **backend**: `cd mk12-backend && npm run typecheck`
- **remotion**: `cd remotion && npx tsc --noEmit`
- **all**: Run all three in parallel

Report any type errors found, grouped by file. If there are errors, suggest fixes.
