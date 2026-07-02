# Patch 23 Proof Summary

## Status
Patch 23 focused validation passed. The broad platform `proof:all` suite still needs review because of existing non-Patch-23 security-definer and staging evidence gates.

## Commands Run
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run patch23:all`: passed.
- `npm run proof:all`: failed review required.
- `npm run v700:runtime-security`: command exited 0, report status `critical_remediation_required`.

## Patch 23 Focused Proof
`npm run patch23:all` completed:
- TypeScript compile passed.
- Production build passed.
- `patch23:evidence-audit` passed.
- `patch23:evidence-security` passed.
- `patch23:evidence-bridge` passed.

Generated focused reports:
- `release/patch23/patch23-evidence-governance-audit.json`
- `release/patch23/patch23-evidence-security-audit.json`
- `release/patch23/patch23-evidence-bridge-audit.json`

## Broad Proof Blockers
`npm run proof:all` summary:
- Passed commands: 13.
- Failed commands: 4.
- Failed commands: `v673:security-definer-audit`, `v672:capture`, `v662:strict-proof`, `v66:strict-proof`.

Observed blockers:
- Security-definer execute audit reported remaining broad execute grants.
- V64 and V65 local SQL capture failed in `v672:capture`.
- Strict evidence quality and go/no-go gates still require staging/manual evidence completion.

## Runtime Security
`npm run v700:runtime-security` exited 0 and reported:
- `frontend_rpc_total`: 1.
- `remaining_broad_security_definer_execute_grants`: 6.
- `managed_schema_broad_security_definer_observations`: 5.
- `service_role_only_rpc_called_by_frontend`: 0.
- `service_role_only_rpc_without_bridge_plan`: 0.

## Safety Notes
Patch 23 is additive. It does not reset the database, remove existing Evidence pages, weaken RLS, modify Patch 20 imports, rewrite Patch 21 OVR workflow, rewrite Patch 22 Risk workflow, or touch payroll-sensitive fields.
