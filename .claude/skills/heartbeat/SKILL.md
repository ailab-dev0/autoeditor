---
name: heartbeat
description: Use when a build completes to review recent changes, verify correctness, run type checks, and auto-fix any issues found
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
model: claude-sonnet-4-6
argument-hint: [service]
---

# Heartbeat - Post-Build Health Check

Automatically triggered after builds complete. Reviews recent changes, verifies everything works, and fixes issues.

## Trigger

Runs automatically via PostToolUse hook when a Bash command matches a build pattern (next build, npm run build, tsc, etc). Can also be invoked manually with `/heartbeat [service]`.

## Process

### 1. Identify What Changed

```bash
git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached
git diff --stat HEAD~1 2>/dev/null || git diff --stat --cached
```

Focus on files that were recently modified — these are the most likely source of issues.

### 2. Type Check the Affected Service

Determine which service was affected from the changed files:

| Path prefix | Service | Command |
|-------------|---------|---------|
| `mk12-dashboard/` | Dashboard | `cd mk12-dashboard && npx tsc --noEmit` |
| `mk12-backend/` | Backend | `cd mk12-backend && npm run typecheck` |
| `remotion/` | Remotion | `cd remotion && npx tsc --noEmit` |
| `mk12-animation-engine/` | Animation | `cd mk12-animation-engine && npx tsc --noEmit` |

If `$ARGUMENTS` specifies a service, check only that one.

### 3. Lint Check (if available)

```bash
cd <service-dir> && npm run lint 2>/dev/null
```

### 4. Review Changed Files for Common Issues

Read each changed `.ts`/`.tsx` file and check for:

- **Runtime errors**: Accessing properties on potentially undefined values (like the `statusConfig.icon` pattern)
- **Missing imports**: New components or utilities used but not imported
- **Type mismatches**: Function signatures that don't match their call sites
- **Broken patterns**: Deviations from existing code patterns in the same file
- **Dead code**: Unused imports, variables, or functions introduced by the change

### 5. Fix Issues Found

For each issue:
1. Read the surrounding code for context
2. Apply the minimal fix
3. Re-run the type checker to confirm the fix

### 6. Report

Output a brief summary:

```
Heartbeat: [service] - [pass/fail]
- Checked N files
- Found M issues, fixed K
- [list any unfixed issues requiring attention]
```

## What NOT to Do

- Do not refactor or "improve" code beyond fixing actual issues
- Do not add comments, docstrings, or type annotations to unchanged code
- Do not change formatting or style
- Do not add error handling for hypothetical scenarios
- Keep fixes minimal and focused
