# Patch 38 Implementation Summary

Generated: 2026-07-03

## Scope

Patch 38 adds a unified daily work queue and governed hospital master data overlays.

## Migration

- `supabase/migrations/099_patch38_unified_work_queue_hospital_master_data.sql`

## Tables Added

- `hospital_master_locations`
- `hospital_master_services`
- `hospital_master_clinical_areas`
- `hospital_master_committees`
- `hospital_master_job_titles`
- `hospital_master_quality_indicators`
- `hospital_master_ownership_mappings`
- `unified_work_queue_events`

## Unified Queue Sources

The unified queue uses stable existing sources:

- Patch 35 accreditation clause tasks.
- Patch 33 evidence collection requests.
- Patch 29 training assignment queue.
- Patch 37 audit test steps, findings, signoffs, OVR RCA cases, and clinical governance escalations.
- Patch 28 CAPA action items.
- Patch 26 document acknowledgment requirements.
- Patch 27 approval requests.

## Frontend/API

- Added `src/lib/unifiedWorkQueueApi.ts`.
- Added `src/pages/MyWorkCenter.tsx`.
- Added `src/lib/hospitalMasterDataApi.ts`.
- Added `src/pages/HospitalMasterDataCenter.tsx`.
- Added `Unified My Work` to the Work Execution hub.
- Added `Hospital Master Data` to the System Control Pages hub.

## Security

- RLS enabled on all new tables.
- Views are `security_invoker`.
- Write functions are service-role-only and intended for the existing authenticated bridge pattern.
- Event logging is required for master data create/status/deactivation and queue summary access.

## Integration Assumptions

- Existing departments/profiles/user roles are reused.
- No existing department/user structure is replaced.
- Sources with stable schemas are included; uncertain module internals are omitted rather than guessed.
