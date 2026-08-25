# v6.4 Database Security Proof Report

Generated: 2026-08-25T00:46:22.450Z

## Overall

```json
{
  "generated_at": "2026-08-25T00:46:22.450Z",
  "rls_static_strict_passed": true,
  "function_static_strict_passed": true,
  "view_static_strict_passed": true,
  "high_risk_findings": 0,
  "database_security_status": "static_ready_pending_staging_persona_sql",
  "warning": "Static readiness does not equal production proof. Run the SQL persona tests in staging."
}
```

## Audit summaries

### RLS static audit

```json
{
  "migration_files_scanned": 186,
  "created_tables_detected": 656,
  "tables_with_explicit_rls": 595,
  "tables_with_forced_rls": 42,
  "tables_with_detected_policies": 532,
  "controlled_deny_all": 26,
  "findings_total": 61,
  "critical": 0,
  "high": 0,
  "medium": 61,
  "strict_passed": true,
  "note": "Static audit only. CONTROLLED_DENY_ALL requires structural proof of ENABLE RLS, FORCE RLS, an ordered complete tracked-role ACL lockdown after the final RLS state, explicit final browser-role revocation, zero policies, zero later browser grants, and unambiguous ACL history.",
  "generated_at": "2026-08-25T00:46:20.825Z"
}
```

### Security function audit

```json
{
  "generated_at": "2026-08-25T00:46:21.277Z",
  "migration_files_scanned": 186,
  "security_definer_functions_detected": 646,
  "global_security_definer_lockdown_detected": true,
  "findings_total": 0,
  "critical": 0,
  "high": 0,
  "medium": 0,
  "strict_passed": true,
  "note": "Static scan strips SQL comments, honors later SECURITY INVOKER changes, and recognizes the v6.7.3 dynamic blanket revoke. The live v6.7.3 database audit remains authoritative for effective grants."
}
```

### View security audit

```json
{
  "generated_at": "2026-08-25T00:46:21.667Z",
  "migration_files_scanned": 186,
  "views_detected": 544,
  "findings_total": 86,
  "critical": 0,
  "high": 0,
  "medium": 86,
  "strict_passed": true,
  "note": "Static scan deduplicates views and recognizes later ALTER VIEW ... SET (security_invoker=true). Final proof still requires staging verification."
}
```

## High-risk findings

No high-risk static findings. Run staging SQL persona tests next.

## Required staging proof

- Apply migrations to a fresh Supabase staging database.
- Run `supabase/tests/v64_persona_security_tests.sql`.
- Test five real users: Admin, Super User, Audit, Manager, Employee.
- Attach SQL output to release evidence.
