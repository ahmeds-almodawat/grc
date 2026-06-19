# GRC Control Center Architecture

## Purpose

GRC Control Center is an internal governance, risk, compliance, audit, OVR, evidence, approval, and reporting platform. It is built for a hospital/company environment where Arabic/English support, RTL layout readiness, strict authorization, controlled release evidence, and confidentiality are mandatory.

The current architecture is aimed at controlled internal pilot readiness. It is not yet a production-certified deployment.

## System overview

At a high level, the platform has four major layers:

```text
User interface
  -> React / TypeScript / Vite application
Application services and runtime bridges
  -> Supabase client calls and authenticated bridge actions
Database and policy layer
  -> PostgreSQL, PLpgSQL, RLS policies, RPCs, audit/evidence data
Evidence and release layer
  -> release/v* reports, proof scripts, manual signoff gates
```

## Frontend structure

The frontend is responsible for:

- Rendering bilingual Arabic/English screens.
- Supporting RTL-ready layouts.
- Presenting GRC, OVR, audit, project/task, approval, and reporting flows.
- Calling safe authenticated APIs or runtime bridge actions.
- Avoiding direct service-role behavior from browser code.
- Supporting persona-based access expectations.

Frontend code must not contain service-role secrets or bypass database authorization.

## Supabase and database role

Supabase provides:

- PostgreSQL database storage.
- Authentication context.
- Row Level Security enforcement.
- RPC functions where needed.
- Edge/runtime bridge layer for actions that must not expose privileged behavior to the browser.

Database logic is significant because compliance platforms should enforce access boundaries close to the data, not only in the UI.

## RLS and authorization model

The security model is based on these principles:

1. Users must be authenticated before accessing controlled records.
2. Roles/personas define what a user can view or act on.
3. RLS policies are the primary database access boundary.
4. Frontend checks are usability helpers, not the final security boundary.
5. Service-role access must never be exposed to browser runtime.
6. Any privileged operation must go through an authenticated backend/edge bridge with evidence.

Current proof evidence indicates:

```text
Runtime security bridge: passed
Authenticated persona proof: passed
Required scenarios: passed
Service-role-only RPCs called directly by frontend: 0
Remaining broad execute grants: 0
```

These results support controlled-pilot readiness but do not replace live staging validation.

## Runtime bridge model

The runtime bridge model exists to prevent unsafe browser-side privileged database access.

Expected bridge behavior:

- Browser calls authenticated bridge action.
- Bridge verifies authenticated user context.
- Bridge performs controlled operation.
- Evidence scripts confirm expected bridge actions exist and unsafe direct RPC use is not present.

This model is especially important because OVR, incident, audit, and compliance data may later become sensitive.

## Persona proof model

Persona proof validates representative access scenarios for required roles/personas.

Evidence currently distinguishes between:

- Synthetic/non-confidential test data.
- No real patient identifiers.
- No confidential OVR data.
- Required authenticated personas.
- Required authorization scenarios.

Persona proof is a controlled-pilot readiness signal. Production readiness still requires staging/live validation.

## OVR and confidentiality boundary

OVR / incident workflows are treated as high-sensitivity features.

Before real OVR usage:

- Confidentiality confirmation must be signed by real IT and Quality reviewers.
- No confidential OVR details should be used during technical pilot testing.
- Pilot scope must clearly say synthetic/non-confidential data only.
- Access and visibility rules must be validated with real authenticated users in staging.

## Evidence and release folder model

The project uses release evidence folders such as:

```text
release/v62
release/v64
release/v66
release/v672
release/v673
release/v674
release/v700
release/v72
release/v73
```

These folders contain generated proof reports, audit summaries, acceptance results, and manual evidence state.

Important distinction:

- Evidence versions are internal proof/checkpoint versions.
- They are not the same as public npm package semantic versioning.
- They should not be treated as production release tags unless explicitly promoted in the release policy.

## Controlled-pilot flow

Recommended flow:

```text
1. Static checks pass
2. Build passes
3. Runtime security bridge proof passes
4. Authenticated persona proof passes
5. Restore dry-run passes
6. SQL evidence capture passes
7. v7.3 module acceptance passes with no blockers
8. Real human signoff and confidentiality confirmation are completed
9. proof:all fully passes
10. Controlled internal pilot begins using synthetic/non-confidential data only
```

## Human signoff gate

The human signoff gate is intentional and must remain blocking.

Files:

```text
release/v674/approvals/pilot-signoff.json
release/v674/approvals/ovr-confidentiality-confirmation.json
```

Do not fake, auto-fill, or bypass these approvals.

## Known limitations before production

The platform is not production ready until these are resolved:

- Real human signoff is completed.
- `proof:all` fully passes.
- CI/CD is active and passing on GitHub.
- RLS/persona validation is run against staging/live Supabase, not only local/static evidence.
- Deployment and rollback process are documented and tested.
- Versioning is consolidated under a formal release policy.
- Old proof scripts are documented or consolidated safely.
- Repo hygiene issues, including tracked ZIP artifacts if any, are addressed without unsafe history rewrites.

## Non-goals for v7.4

v7.4 repo hardening does not:

- Change approval files.
- Mark the platform production ready.
- Bypass `v66:strict-proof`.
- Rewrite database migrations.
- Change RLS policies.
- Rewrite Git history.
- Remove old evidence scripts.
