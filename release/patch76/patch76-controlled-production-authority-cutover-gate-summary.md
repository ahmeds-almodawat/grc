# Patch 76 Controlled Production Authority and Cutover Gate

Patch 76 adds a governed, auditable controlled production authority decision record.

## Scope

- Added `controlled_production_cutover_decisions`.
- Added `controlled_production_cutover_decision_events`.
- Added server-side decision guardrails for approved states.
- Added authenticated bridge API wrappers for controlled decision recording and audit event recording.
- Added a controlled cutover decision section to Production Readiness Center.
- Added restore-noise coverage for the Patch 75 generated proof JSON.

## Safety

- The decision record does not automatically launch the system.
- Live transition requires separate operational execution.
- Critical blockers prevent approval.
- Approved-with-limitations requires limitation review.
- Approved states require the cutover checklist to be complete.
- No fake records were added.
- No production-ready claim was added.
