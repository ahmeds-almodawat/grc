# Patch 25 Post-Implementation Audit

Date: 2026-07-02
Workspace: `C:\Users\molte\Downloads\grc-control-center`

## Branch Check

- Current branch: `patch23-evidence-bridge-governance`
- Intended Patch 25 branch: `patch25-compliance-obligation-calendar`
- Result: **Not on intended Patch 25 branch**
- Worktree note: `patch25-compliance-obligation-calendar` exists, but it is checked out in `C:/Users/molte/Downloads/grc-control-center-patch25`, not this workspace.

## Git Commands Requested

### `git status --short --branch`

Current worktree is dirty and mixed:

- Modified proof/release artifacts under `release/v62`, `release/v64`, `release/v66`, `release/v661`, `release/v662`, `release/v663`, `release/v672`, `release/v673`, `release/v674`, `release/v700`, and `release/v72`
- Modified implementation files:
  - `package.json`
  - `scripts/v673-apply-local-migration.mjs`
  - `scripts/v72-real-authenticated-persona-proof.mjs`
  - `src/lib/grcApi.ts`
  - `src/pages/Audit.tsx`
  - `src/pages/Evidence.tsx`
  - `src/types/domain.ts`
  - `supabase/functions/privileged-action/index.ts`
- Untracked patch artifacts:
  - `release/patch23/`
  - `release/patch24/`
  - `release/platform-health/`
  - `scripts/patch23-evidence-bridge-audit.mjs`
  - `scripts/patch23-evidence-governance-audit.mjs`
  - `scripts/patch23-evidence-security-audit.mjs`
  - `scripts/patch24-audit-closure-gate-audit.mjs`
  - `scripts/patch24-audit-findings-security-audit.mjs`
  - `scripts/patch24-audit-findings-workflow-audit.mjs`
  - `supabase/migrations/085_patch23_evidence_bridge_governance.sql`
  - `supabase/migrations/086_patch24_audit_findings_workflow_hardening.sql`
  - `supabase/migrations/087_patch25_compliance_obligation_calendar.sql`
  - `supabase/migrations/088_platform_security_definer_post_patch_lockdown.sql`

### `git diff --stat main...HEAD`

No committed diff was reported from `main...HEAD`.

### `git diff --name-only main...HEAD`

No committed changed files were reported from `main...HEAD`.

## Migration

- Found: `supabase/migrations/087_patch25_compliance_obligation_calendar.sql`
- Status: present but untracked in this workspace

## Patch 25 Database Objects Found

Tables and altered tables:

- Extends `public.compliance_items` with obligation lifecycle, owner/reviewer/sponsor, status/stage, renewal, review, evidence gate, closure, overdue, escalation, and reopen fields.
- Creates `public.compliance_regulatory_calendar`.
- Creates `public.compliance_obligation_events`.
- Enables RLS on `public.compliance_regulatory_calendar`.
- Enables RLS on `public.compliance_obligation_events`.

Views:

- `public.v_patch25_compliance_closure_blockers`
- `public.v_patch25_compliance_obligation_queue`
- `public.v_patch25_regulatory_calendar`
- `public.v_patch25_due_soon_obligations`
- `public.v_patch25_overdue_obligations`
- `public.v_patch25_renewal_queue`
- `public.v_patch25_compliance_evidence_gap_dashboard`
- `public.v_patch25_executive_compliance_escalations`

Functions:

- `public.patch25_compliance_accepted_evidence_count(uuid)`
- `public.patch25_compliance_active_waiver_count(uuid)`
- `public.patch25_compliance_closure_satisfied(uuid)`
- `public.patch25_write_compliance_event(uuid, uuid, text, text, text, uuid, text, text, jsonb)`
- `public.patch25_generate_calendar_events(uuid, uuid, text)`
- `public.patch25_compliance_obligation_bridge(uuid, text, jsonb)`

## Required Patch 25 Capabilities

- Compliance obligation lifecycle: found in `compliance_items` lifecycle fields and `patch25_compliance_obligation_bridge`.
- Compliance regulatory calendar: found in `compliance_regulatory_calendar` and `v_patch25_regulatory_calendar`.
- Compliance obligation event history: found in `compliance_obligation_events` and `patch25_write_compliance_event`.
- Due soon obligations: found in `v_patch25_due_soon_obligations`.
- Overdue obligations: found in `v_patch25_overdue_obligations`.
- Renewal queue: found in `v_patch25_renewal_queue`.
- Evidence gate compatibility: found through `evidence_links`, `evidence_requirements`, and `evidence_gate_waivers` compatibility checks in Patch 25 functions/views.
- Closure blockers: found in `v_patch25_compliance_closure_blockers` and bridge closure approval blocker handling.
- Executive escalation views: found in `v_patch25_executive_compliance_escalations`.
- Patch 25 release evidence under `release/patch25/`: missing before this audit. This audit report creates the directory, but the expected Patch 25 checklist/proof artifacts were not present.

## UI/API Changes

- Targeted search found no Patch 25 UI/API wiring in `src`, `scripts`, `package.json`, or `supabase/functions/privileged-action/index.ts`.
- `npm run patch25:all` is not defined in `package.json`.
- Current modified UI/API files appear to belong to Patch 23 Evidence Bridge and Patch 24 Audit Findings work, not isolated Patch 25 work.

## Isolation Check

- Patch 21 OVR: no visible uncommitted Patch 21 artifacts in `git status`.
- Patch 22 Risk: no visible uncommitted Patch 22 artifacts in `git status`.
- Patch 23 Evidence Bridge: **not isolated**; Patch 23 files and modified Evidence/API/type files are present.
- Patch 24 Audit Findings: **not isolated**; Patch 24 files and modified Audit/API/type files are present.
- UI platform shell refactor: no active shell-refactor files were identified in the current status, but the worktree is still mixed because of Patch 23, Patch 24, generated proof artifacts, and platform-health security helper changes.

Conclusion: **Patch 25 is not isolated in this workspace.**

## Validation Results

- `npm run typecheck`: passed
- `npm run build`: passed
- `npm run patch25:all`: failed because the script is missing
- `npm run proof:all`: passed, `17/17`
- `npm run v700:runtime-security`: passed

Skipped or missing commands:

- `patch25:all` is missing from `package.json`, so no Patch 25-specific scripted audit suite ran in this workspace.

## Conflict Marker Check

Search performed for:

- `<<<<<<<`
- `=======`
- `>>>>>>>`

Result:

- No conflict markers found with the conflict-marker scan.
- `release/v700/proof-suite-all.json` has no conflict markers.

## Safe To Commit/Push?

Not safe to commit or push this workspace as Patch 25.

Reasons:

- Current branch is `patch23-evidence-bridge-governance`, not `patch25-compliance-obligation-calendar`.
- `main...HEAD` has no committed Patch 25 diff.
- Patch 25 migration is present only as an untracked file in this workspace.
- `release/patch25/` expected evidence was missing before this audit report.
- `patch25:all` script is missing.
- Worktree contains mixed Patch 23, Patch 24, generated proof, and platform-health changes.

Recommended next command:

```powershell
cd C:\Users\molte\Downloads\grc-control-center-patch25
git status --short --branch
```

Then audit/commit Patch 25 from the actual `patch25-compliance-obligation-calendar` worktree if that branch contains the intended isolated implementation.
