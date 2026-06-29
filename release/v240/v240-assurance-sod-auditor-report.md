# v24.0 Assurance, SoD, Immutable Log + Auditor Evidence Pack

## Purpose

This pack closes the final professional external-review gap by defining a minimal assurance layer across framework coverage, segregation of duties, immutable logging, evidence integrity and auditor workspaces.

## Professional assurance chain

Framework Requirement → Control → Test → Evidence Integrity → SoD Check → Immutable Log → Auditor Pack → Assurance Opinion

## Added schema contract

- v240_sod_rules
- v240_sod_violations
- v240_immutable_audit_events
- v240_evidence_integrity_index
- v240_auditor_workspaces
- v240_auditor_export_manifests

## Security posture

- RLS explicitly enabled on all v24 tables.
- Authenticated SELECT/INSERT/UPDATE is deny-by-default pending reviewed org-scoped policies or Edge bridges.
- No authenticated DELETE policy is added.
- No broad true RLS policy is introduced.

## What this does not claim

This pack does not certify the organization, does not replace an external auditor, and does not claim accreditation. It creates the platform evidence structure needed for external review readiness.
