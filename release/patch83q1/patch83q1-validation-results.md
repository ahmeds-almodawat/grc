# Patch 83Q.1 Validation Results

All requested local validation gates passed on 2026-07-12:

| Command | Result |
| --- | --- |
| `git diff --check` | passed |
| `npm run validate:build` | passed; TypeScript and Vite production build completed |
| `npm run test:unit` | passed; 3 files and 22 tests |
| `npm run validate:security` | passed; no remaining broad SECURITY DEFINER grants and no frontend service-role-only RPC calls |
| `npm run patch83p:proof` | passed |
| `npm run patch83q:proof` | passed |
| `npm run patch83q1:proof` | passed; 36 focused checks |
| `npx supabase migration list` | passed; local and remote include migration 170 |
| `npx supabase functions list` | passed |

The sandbox initially prevented Vite/Vitest helper processes and the Patch 83Q proof's read-only git subprocess. Each command was rerun unchanged with the required execution permission and passed. These were environment restrictions, not validation failures.

Focused Patch 83Q.1 checks cover missing and invalid JWT denial paths, organization-scoped role denial, invalid UUID/status/event-type rejection, all four fixed mappings, caller-controlled RPC prevention, no direct browser RPC calls, derived actor identity, unchanged Department Import and User Import mappings, and unchanged migration 170 grants.
