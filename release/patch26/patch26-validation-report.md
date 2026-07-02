# Patch 26 Validation Report

Date: 2026-07-02
Workspace: `C:\Users\molte\Downloads\grc-control-center`

## Branch And Base

- Current branch: `patch26-document-control-sop-governance`
- Resumed existing Patch 26 branch: yes
- Chosen base branch: `main` / V81
- Reason: the worktree was clean on `main` before creating Patch 26, and Patch 25 artifacts are already present in this base.
- `git diff --stat main...HEAD`: no committed diff yet because Patch 26 work is currently uncommitted.
- `git diff --name-only main...HEAD`: no committed files yet because Patch 26 work is currently uncommitted.

## Patch 25 Presence In Main/V81

Checks requested:

- `Test-Path .\supabase\migrations\087_patch25_compliance_obligation_calendar.sql`: `True`
- `Test-Path .\release\patch25`: `True`

Conclusion: Patch 25 appears to already be present in main/V81.

## Files Changed

Patch 26 implementation files:

- `package.json`
- `scripts/patch26-document-control-schema-proof.mjs`
- `scripts/patch26-document-control-workflow-proof.mjs`
- `supabase/migrations/089_patch26_document_control_sop_governance.sql`
- `release/patch26/patch26-implementation-summary.md`
- `release/patch26/patch26-schema-proof.json`
- `release/patch26/patch26-workflow-proof.json`
- `release/patch26/patch26-validation-report.md`

Validation also refreshed generated release evidence under existing `release/v*` folders.

## Migration Added

- Added: `supabase/migrations/089_patch26_document_control_sop_governance.sql`
- Requested migration name was `088_patch26_document_control_sop_governance.sql`.
- Adjustment made: `088_platform_security_definer_post_patch_lockdown.sql` already exists in main/V81, so Patch 26 uses `089` to avoid duplicate Supabase migration versions.

## Tables Added

- `controlled_documents`
- `document_versions`
- `document_review_events`
- `document_links`
- `document_acknowledgment_requirements`
- `document_acknowledgments`

## Views Added

- `v_patch26_document_control_register`
- `v_patch26_active_sops`
- `v_patch26_documents_due_for_review`
- `v_patch26_expired_documents`
- `v_patch26_pending_document_reviews`
- `v_patch26_pending_document_approvals`
- `v_patch26_superseded_documents`
- `v_patch26_staff_acknowledgment_gaps`
- `v_patch26_document_link_index`

## Functions Added

- `patch26_write_document_event`
- `submit_document_for_review`
- `approve_document_version`
- `reject_document_version`
- `activate_document_version`
- `start_document_revision`
- `retire_controlled_document`
- `link_document_to_item`
- `record_document_acknowledgment`

Skipped functions:

- `create_controlled_document`: skipped to keep scope lean.
- `supersede_document_version`: skipped in this lean foundation; revision and current-version handling are present.
- `reopen_controlled_document_with_reason`: skipped to avoid expanding workflow surface.
- `create_document_acknowledgment_requirement`: skipped; table foundation exists, but no extra RPC was added.

## UI/API Changes

- UI changes: none
- API changes: none
- Package changes: added `patch26:schema-proof`, `patch26:workflow-proof`, and `patch26:all`

## Compatibility

- Patch 25 compliance compatibility: `document_links.linked_item_type = 'compliance_obligation'`.
- Patch 23 evidence compatibility: `document_links.linked_item_type = 'evidence'`.
- No Patch 23 or Patch 25 workflow code was modified.

## Validation Results

- `npm run typecheck`: passed as part of `npm run patch26:all` and again inside `npm run proof:all`
- `npm run build`: passed as part of `npm run patch26:all` and again inside `npm run proof:all`
- `npm run patch26:all`: passed
- `npm run proof:all`: passed, `17/17`
- `npm run v700:runtime-security`: passed

Patch 26 proof artifacts:

- `release/patch26/patch26-schema-proof.json`: passed, `blocking_count: 0`
- `release/patch26/patch26-workflow-proof.json`: passed, `finding_count: 0`

Skipped or missing commands:

- None among the requested commands.

## Conflict Marker Check

Search performed for:

- `<<<<<<<`
- `=======`
- `>>>>>>>`

Results:

- No conflict markers found.
- `release/v700/proof-suite-all.json` has no conflict markers.

## Isolation Confirmation

Patch 26 stayed isolated:

- Did not start Patch 27 Approval Authority Matrix.
- Did not start Patch 28 CAPA.
- Did not start Patch 29 Training/Competency.
- Did not touch Patch 20 import logic.
- Did not touch payroll-sensitive fields.
- Did not modify OVR, Risk, Evidence Bridge, Audit Findings, Compliance workflow code, or the UI platform shell.
- Did not run production migrations or reset the database.
- Did not weaken RLS/security policies.
