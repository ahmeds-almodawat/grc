# Production Gate 8 V2 complete staging rehearsal

## Decision

**PRODUCTION GATE 8 PASSED — STAGING REHEARSAL COMPLETE**

The single authorized attempt `6447c686-7ae1-4166-9b47-ab22de82ced7` applied frozen migrations 178–182 to staging in exact order with exit code 0. No retry occurred. Read-only state determination found all five history rows and principal objects, latest migration 182, and no unexpected later migration.

The exact postflight passed: attestation `overall_pass=true`; runtime remains enforced at state version 5; expression uniqueness has no duplicate groups; the activation view is security-invoker/security-barrier; runtime-action browser DML is closed; and all 18 legacy tables have RLS enabled and forced with no browser grants or policies.

## Catalog comparison

The hosted 31-record catalog contract matches semantically. The hosted raw hash is `78ab27d7b8d86232285e2bf26a2be92f9966aad35cc53812ff208b55eea32c08`, versus Gate 7R `5feba35fc324214c45f728f61fb6556aa76cff1a97f470395830e0b8191f1f10`. The complete difference is the environment-specific PostgreSQL OID serialized for the same `authenticated` role in four policy records (16444 in the fixture, 16485 on staging). No function, RLS, ACL, policy-expression, relation, index, or constraint drift exists. This is a documented fingerprint-normalization defect with zero unexplained differences.

## Smoke and validation

The clean signed-out staging frontend loaded Login with HTTP 200, no console/error overlay, and no production request. Read-only security smoke checks denied unknown/unsigned actions, denied browser attestation access, and passed service-role attestation without selecting or mutating business data.

Local results: 1,151/1,151 unit tests; 55/55 focused tests; 25/25 final serial Patch 83U Playwright tests; disposable pre-178→post-182 upgrade, SQL governance/adversarial tests, and exact-state reapplication all passed; TypeScript, Deno Edge check, production build, secret scan, JSON parsing, skip/only scan, and `git diff --check` passed.

The first browser run reused the still-running staging Vite port and recorded one 1.19-pixel sticky-header geometry miss with one subsequent test not run. After stopping only that smoke-test process, the complete clean serial run passed 25/25. No product or test file was changed.

No Auth account or business record was modified. No source, migration, or test was changed during Gate 8. Production was not accessed. No commit, push, tag, deployment, or staging of files occurred.
