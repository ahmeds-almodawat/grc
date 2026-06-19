# Release Notes — v1.8 Security & Audit Controls

## Goal

Strengthen the platform before wide rollout by adding security governance, access-review signals, sensitive activity visibility and data-retention readiness.

## Highlights

- Security posture score for executive visibility.
- Sensitive role monitoring for super admin, executive and governance admin access.
- Warnings for broad access assigned to limited roles.
- Warnings for department-scoped roles without department references.
- Stale sensitive-role review indicator.
- Sensitive activity timeline combining security review events and high-impact audit logs.
- Retention rule metadata for audit logs, OVR, evidence, approvals, export logs and UI performance events.
- Manual security review event logging.
- Retention readiness export to CSV.
- Bilingual English/Arabic page and navigation.

## Database

New migration:

- `020_security_audit_retention_controls.sql`

New tables:

- `security_review_events`
- `data_retention_rules`
- `access_review_cycles`

New views:

- `v_security_governance_summary`
- `v_security_access_findings`
- `v_data_retention_readiness`
- `v_sensitive_activity_timeline`

## Governance rule

Retention is informational and controlled. It is not an auto-delete feature. Deletion or archiving must be approved, backed up and audit logged.
