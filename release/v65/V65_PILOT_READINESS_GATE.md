# v6.5 Pilot Readiness Gate

```json
{
  "generated_at": "2026-06-18T19:38:12.430Z",
  "gates_total": 9,
  "automated_gates_passed": 6,
  "manual_gates_required": 3,
  "blocking_count": 3,
  "controlled_pilot_status": "not_ready_manual_evidence_required",
  "recommendation": "Use for controlled internal testing only until staging persona SQL, restore dry-run, and pilot signoff are attached."
}
```

## Gates

- **passed_by_previous_phase** TYPECHECK_BUILD — v65 phase runner typecheck/build
- **passed** NO_MOCK_STATIC — release/v60/v60-production-data-audit.json
- **passed** DB_SECURITY_STATIC — release/v64/v64-database-security-proof-summary.json
- **passed** AUTH_SMOKE — release/v65/v65-auth-security-smoke.json
- **passed** WORKFLOW_CONTRACTS — release/v65/v65-workflow-contract-tests.json
- **passed** TEST_ASSETS — release/v65/v65-test-assets-audit.json
- **manual_required** STAGING_PERSONA_SQL — Run supabase/tests/v64_persona_security_tests.sql in staging and attach output.
- **manual_required** RESTORE_DRY_RUN — Restore staging backup and verify table/storage samples.
- **manual_required** PILOT_SIGNOFF — IT + Quality + Admin signoff before real pilot.

## Pilot rule

Do not enter confidential OVR or patient-identifying data until staging persona SQL and restore dry-run evidence pass.
