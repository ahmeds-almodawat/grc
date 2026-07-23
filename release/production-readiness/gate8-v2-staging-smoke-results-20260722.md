# Production Gate 8 V2 staging smoke results

Result: **passed**

The staging startup guard resolved only `zghsgzrdwbqdrpuxanac`. A fresh nonpersistent, signed-out browser loaded the normal Login page with HTTP 200, no reconciliation screen, no error overlay, no console errors, and no production request. No credential was entered and no session was created.

Read-only SQL with explicit rollback confirmed browser DML is absent from both runtime-action tables and all 18 legacy tables. Unknown and unsigned runtime actions returned denied under the service-role contract. The catalog attestation is not executable by browser roles, is executable by service role, and returned `overall_pass=true`. Credential-governance/runtime compatibility and last-Super-Admin recovery bindings remain intact.

The Supabase security advisor reports 18 informational `RLS enabled, no policy` notices for the deliberately browser-closed legacy tables. This is the intended migration-182 access model. Its remaining 53 warnings concern pre-existing objects or Auth configuration outside migrations 178–182; none is a new Gate 8 scope finding.

No Auth account or business record was modified. Production was not accessed.
