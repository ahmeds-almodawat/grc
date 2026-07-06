# Patch 81 Post-Apply Verification Checklist

Use this checklist after applying migrations 118 through 121 in staging or production.

## Database Objects

- [ ] Patch 76 tables exist.
- [ ] Patch 77 tables exist.
- [ ] Patch 78 tables exist.
- [ ] Patch 79 tables exist.
- [ ] RLS is enabled on all new tables.
- [ ] Required indexes and constraints are present.
- [ ] No sample or placeholder records were inserted.

## Security and Bridge Checks

- [ ] Privileged bridge checks passed.
- [ ] Privileged RPCs are not callable directly by browser clients.
- [ ] Unauthorized access is blocked.
- [ ] Service role secret is not exposed in frontend code or browser state.
- [ ] Runtime security validation passed.

## Application Checks

- [ ] Production Readiness Center loads.
- [ ] Production Operator Console loads.
- [ ] Patch 76 controlled cutover decision section works.
- [ ] Patch 77 pilot issue burn-down section works.
- [ ] Patch 78 access integrity section works.
- [ ] Patch 79 hypercare and board pack section works.
- [ ] No automatic production launch was triggered.

## Evidence

- [ ] Migration logs captured.
- [ ] Screenshots captured.
- [ ] Validation commands recorded.
- [ ] Issues and resolutions recorded.
- [ ] Final deployment decision recorded.

Deployment verification does not approve production launch.
