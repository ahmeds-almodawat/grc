# v6.4 Database Security Proof Report

Generated: 2026-06-29T12:27:47.825Z

## Overall

```json
{
  "generated_at": "2026-06-29T12:27:47.825Z",
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
  "generated_at": "2026-06-29T12:27:44.028Z",
  "migration_files_scanned": 64,
  "created_tables_detected": 282,
  "tables_with_explicit_rls": 222,
  "tables_with_detected_policies": 192,
  "findings_total": 60,
  "critical": 0,
  "high": 0,
  "medium": 60,
  "strict_passed": true,
  "note": "Static audit only. Final proof requires applying migrations to staging and running supabase/tests/v64_persona_security_tests.sql."
}
```

### Security function audit

```json
{
  "generated_at": "2026-06-29T12:27:44.961Z",
  "migration_files_scanned": 64,
  "security_definer_functions_detected": 45,
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
  "generated_at": "2026-06-29T12:27:45.925Z",
  "migration_files_scanned": 64,
  "views_detected": 168,
  "findings_total": 105,
  "critical": 0,
  "high": 0,
  "medium": 105,
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
