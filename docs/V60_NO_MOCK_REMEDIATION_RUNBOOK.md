# v6.0 No-Mock Remediation Runbook

## Purpose
Production users must never see silent mock/demo/fallback/sample data. If Supabase has no data or cannot be reached, the UI should show a clear live-data empty state.

## Apply

```bash
node scripts/v60-install-no-mock-scripts.mjs
npm run v60:remediate
npm run typecheck
npm run build
npm run v60:strict
npm run v60:phases
```

## Supabase

Run migration:

```text
supabase/migrations/039_v60_no_mock_production_data_controls.sql
```

Then seed:

```sql
select seed_v60_no_mock_controls_defaults();
select * from v_v60_no_mock_control_scorecard;
select * from v_v60_empty_state_readiness;
```

## Target

```text
production_blocking_findings = 0
```

Medium findings may remain only when they are unused definitions, documentation, or explicitly gated non-production demo assets.

## Production environment

```env
VITE_ALLOW_DEMO_DATA=false
```

Demo data may only be enabled in local/staging, never production.
