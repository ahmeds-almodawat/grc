# v6.2 Real No-Mock Data Layer Runbook

## Purpose

v6.2 moves the project from regex-based no-mock cleanup toward a real production data contract.

Production UI must never silently display fictional rows, fallback records, demo dashboards, or sample OVR/risk/compliance data.

## Result contract

Every live-data function should eventually expose one of these states:

- `live`: real Supabase or Edge Function data was loaded.
- `empty`: the live query succeeded, but there are no records.
- `unauthorized`: the user/session/role cannot access the data.
- `configuration_error`: Supabase/Auth/env is missing or misconfigured.
- `query_error`: the query failed.

## Demo boundary

Demo fixtures must live under `src/demo` only and must not be imported by production runtime modules.

Demo mode is allowed only for local development and only when:

```env
VITE_ALLOW_DEMO_DATA=true
```

Production must use:

```env
VITE_ALLOW_DEMO_DATA=false
```

## Commands

```bash
node scripts/v62-install-real-data-scripts.mjs
npm run v62:all
```

## Supabase

After applying migration `040_v62_real_no_mock_data_layer.sql`:

```sql
select seed_v62_real_no_mock_data_layer_defaults();
select * from v_v62_real_data_layer_scorecard;
select * from v_v62_demo_boundary_scorecard;
```

## Exit criteria before auth/RLS hardening

- `npm run typecheck` passes.
- `npm run build` passes.
- `npm run v60:strict` reports 0 blockers.
- `npm run v62:all` passes.
- Demo data exists only in `src/demo`.
- Production empty/error states are explicit.
