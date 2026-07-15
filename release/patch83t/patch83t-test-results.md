# Patch 83T — Validation Status

Documentation update: 2026-07-15 (Asia/Riyadh)

## Corrected-revision status

The optional-`contact_email` and strict-`account_action` correction changes the workbook, validation, preview, execution, provisioning, and test contracts. The results below were recorded against the final uncommitted integrated worktree on 2026-07-15. No migration, hosted Auth action, deployment, or production import was run.

| Required validation | Corrected-revision status |
| --- | --- |
| `npm run typecheck` | Passed. `tsc --noEmit` exited 0. |
| `npm run test:unit` | Passed: 14 files, 222 tests. |
| `npx playwright test tests/e2e/patch83t-user-excel-import.spec.ts --workers=1` | Passed: 5/5 using the safe local fake-Supabase test configuration. |
| `npx playwright test tests/e2e/patch83u-credential-provisioning.spec.ts --workers=1` | Passed: 5/5 using the same controlled local test configuration. |
| `npx playwright test tests/e2e/patch83s-department-excel-import.spec.ts --workers=1` | Passed: 3/3 regression tests using the same controlled local test configuration. |
| `npx playwright test tests/e2e/patch83u-login-captcha-release-gate.spec.ts --workers=1` | Passed: 6/6 local CAPTCHA release-gate tests. No hosted provider request or setting change occurred. |
| `npm run build` | Passed. Vite transformed 1,998 modules and emitted the production bundle; only the existing non-blocking large-chunk advisory was reported. |
| `npm run validate:security` | Passed: zero frontend direct RPC calls, zero broad `SECURITY DEFINER` execute grants, zero frontend calls to service-role-only RPCs, and zero service-role-only RPCs without a bridge plan. Generated v700 reports were restored to `HEAD` afterward. |
| `npm run patch83u:auth-surface` | Passed: 0 direct browser RPCs, 353 browser-referenced views, 0 exposed materialized views, 0 unsafe surfaces, and all 29 legacy view-base tables covered by credential-gated RLS evidence. |
| Edge syntax/type validation | Passed: `npx --yes deno check supabase/functions/privileged-action/index.ts`. The repository `.env.local` was not edited or consumed. |
| `git diff --check` | Passed after the final documentation update. |

## Workbook and planning proof covered locally

The completed local unit, contract, and browser suites cover:

- the exact 12-column contract and absence of password/credential columns;
- blank `contact_email` is valid, populated invalid contact email is rejected, and contact email remains distinct from synthetic Auth email;
- `account_action` accepts only `create`, `update`, and `create_or_update` and enforces each action's exact existing-profile/Auth/provisioning semantics in both preview and backend;
- preview shows the requested action, matched profile, matched Auth identity, matched provisioning identity, and planned operation;
- protected profile proof contains only safe identity-match/organization/active-cross-organization-role evidence, and a case-insensitive-but-not-exact Employee-ID collision blocks `create`, `update`, and `create_or_update` without exposing profile PII;
- Employee IDs `11111` and `001245` remain text, retain leading zeroes/case, and derive `11111@almodawat.sa` and `001245@almodawat.sa`;
- spaces, Arabic characters, `@`, plus, slash, and unsupported symbols in Employee ID are rejected without silent encoding;
- formulas, numeric Employee ID/phone cells, malformed/renamed workbooks, unsupported headers, duplicate headers, and ambiguous sheets are rejected;
- Arabic names and original/normalized phone values are preserved;
- strict role/scope and lifecycle incompatibilities are errors, not warnings;
- validation and preview issue no business write, and no write occurs before the exact Execute Import click and confirmation;
- replacing/removing the workbook or closing the dialog clears `EXECUTE USER IMPORT`, so a confirmation cannot carry over to a replacement payload;
- the protected backend rejects stale identity/access plans and supplies database-derived execution proof, while the client rejects malformed, duplicate, incomplete, or count/digest-mismatched proof;
- a create plan records protected provisioning data but creates no Auth account automatically; and
- roster edit/search/details/export/audit keep Employee login ID, synthetic Auth email, optional contact email, and phone separate.

## Security and regression proof covered locally

The completed local suites also cover service-role-only execution; JWT, same-tenant, canonical-global-actor, workbook role/scope/reference, and lifecycle enforcement; self-change and eligible last-Super-Admin protection; protected provisioning and role evidence; no plaintext secret in payloads/tables/audit/logs; the credential-gated search/view release proof; and unchanged Patch 83S Department Import behavior. Migration 172 remains byte-for-byte unchanged.

## Database and hosted proof

Migrations 173 and 174 remain unapplied and were not executed. The rollback-only database proof and any hosted Supabase Auth proof are separate release gates and are not claimed by this document. No database mutation, hosted browser/Auth operation, or deployment was run. In particular, hosted acceptance of Employee ID `11111` as a password is unproven.
