# v6.1 Real vs Simulated Capability Register

Generated: 2026-06-18T14:22:11.450Z

This register deliberately marks most capabilities as **unverified** until backed by executable tests or signed staging evidence.

## Summary

- Total capabilities: 9
- Partially verified: 1
- Unverified: 8

## Capabilities

| Area | Capability | Artifact detected | Claim level | Production status | Evidence required |
|---|---|---:|---|---|---|
| Governance / GRC workflow | Project, milestone, task, evidence, approval and closure chain | yes | prototype_or_staging_artifact | **unverified** | Executable workflow test against staging Supabase with real roles and audit trail review. |
| OVR / Quality | OVR submission, supervisor/HOD review, Quality review, corrective action and closure path | yes | prototype_or_staging_artifact | **unverified** | End-to-end OVR test with patient-sensitive-field access restrictions and Quality-only closure proof. |
| Production data integrity | No silent mock/demo/fallback rows in production runtime | yes | static_audit_pass_possible | **partially_verified** | Empty database browser test and failed-query browser test proving empty/error states, not fictional records. |
| Authentication | Login/session shell and protected route access | no | unknown_or_unverified | **unverified** | Anonymous access denied, current user profile loaded, inactive user blocked, role-based navigation confirmed. |
| RLS / authorization | Organization/department/persona isolation in Supabase | yes | schema_artifact | **unverified** | Executable SQL persona tests for employee, manager, quality, audit, super admin and negative access cases. |
| Automated testing | Unit, integration and browser workflow tests | no | unknown_or_unverified | **unverified** | CI run with Vitest/RTL/Playwright and disposable Supabase test database. |
| Backup / restore | Database, Storage and Auth recovery procedures | yes | manual_checklist_artifact | **unverified** | Signed restore dry-run to staging with table counts, Storage sample verification and smoke test. |
| Arabic / RTL | Bilingual Arabic/English UI with RTL layout | yes | prototype_or_staging_artifact | **unverified** | Screen-by-screen Arabic QA, untranslated string audit and accessibility review. |
| Performance / scale | 1,000 users / 50 departments readiness | yes | static_or_seed_artifact | **unverified** | Real staging load test, query pagination proof and route lazy-loading browser measurements. |
