# Patch 23 Evidence Bridge & Governance Checklist

## Migration
- [x] Additive migration created: `085_patch23_evidence_bridge_governance.sql`.
- [x] Existing `evidence_files` extended without dropping existing columns or data.
- [x] `evidence_links` supports one evidence file linked to many workflow items.
- [x] `evidence_requirements` defines gate evidence expectations.
- [x] `evidence_review_events` records state transitions and custody events.
- [x] `evidence_gate_waivers` records explicit waiver requests and decisions.
- [x] Review, sensitivity, expiry, owner, reviewer and gate indexes added.

## Governance Views
- [x] Review queue view.
- [x] Gap dashboard view.
- [x] Closure gate status view.
- [x] Chain of custody view.
- [x] Evidence pack index view.
- [x] Sensitive evidence register view.

## Workflow Actions
- [x] Create requirement.
- [x] Link evidence to item.
- [x] Submit evidence for review.
- [x] Accept, reject, revise, supersede and lock evidence.
- [x] Request, approve and reject gate waiver.
- [x] Check gate status and generate pack index.

## UI
- [x] Evidence Governance Center keeps the existing Evidence route.
- [x] Review queue, gap dashboard, closure gates, sensitive register, pack index and detail modal added.
- [x] Legacy Evidence queue remains visible for compatibility.

## Proof
- [x] Patch 23 governance audit script added.
- [x] Patch 23 security audit script added.
- [x] Patch 23 bridge audit script added.
