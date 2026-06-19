# GRC Control Center v1.6 — QA & Deployment Readiness Patch

This patch adds a production readiness layer for controlled go-live preparation.

## Added

- QA & Deployment Readiness Center page.
- Readiness score with blocked/warning deployment gates.
- Default QA test plan seeding function.
- Manual QA test case library.
- Permission persona matrix for RLS/UAT testing.
- Deployment gates combining:
  - backup health checks,
  - access-control warnings,
  - workflow blockers.
- QA test run/result tables.
- Deployment sign-off table.
- CSV exports for QA plans, permission personas, deployment gates and test runs.
- Bilingual Arabic/English labels.

## Database migration

Run:

```sql
supabase/migrations/018_qa_permission_deployment_readiness.sql
```

## Why this matters

Before opening the platform to many employees, management should prove that permissions, workflow blockers, backup/export, OVR closure and evidence rules behave correctly. This patch adds the page and database structures to track that proof.
