# Patch 26 Implementation Summary

Date: 2026-07-02

## Scope

Patch 26 adds the backend foundation for Document Control & SOP Governance. It does not add a document editor, file upload UI, training workflow, approval authority matrix, CAPA workflow, or platform shell redesign.

## Base

- Current branch: `patch26-document-control-sop-governance`
- Base branch: `main` / V81
- Patch 25 presence: `supabase/migrations/087_patch25_compliance_obligation_calendar.sql` and `release/patch25` are present in this main/V81 base.

## Migration

- Added: `supabase/migrations/089_patch26_document_control_sop_governance.sql`
- Note: migration version `088` already exists in main as `088_platform_security_definer_post_patch_lockdown.sql`, so Patch 26 uses `089` to avoid duplicate Supabase migration versions.

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

- `submit_document_for_review`
- `approve_document_version`
- `reject_document_version`
- `activate_document_version`
- `start_document_revision`
- `retire_controlled_document`
- `link_document_to_item`
- `record_document_acknowledgment`
- Internal event helper: `patch26_write_document_event`

All Patch 26 workflow functions write document review events where practical and are service-role only.

## Compatibility

- Patch 25 compliance compatibility is through `document_links.linked_item_type = 'compliance_obligation'`.
- Patch 23 evidence compatibility is through `document_links.linked_item_type = 'evidence'`.
- Full evidence-pack integration and compliance workflow changes were not added.

## Explicitly Skipped

- Patch 27 Approval Authority Matrix
- Patch 28 CAPA
- Patch 29 Training/Competency
- SOP editor
- File upload UI
- Platform shell or navigation redesign
