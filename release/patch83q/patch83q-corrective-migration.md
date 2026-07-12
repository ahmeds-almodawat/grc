# Patch 83Q corrective migration and containment

Migration 170 is an ACL-only correction for four exact user-owned privileged write overloads. It contains no table DDL, data DML, policy or trigger changes, function body changes, managed-schema targets, drops, or Vercel/Edge changes.

Prior live grants:

- `create_pilot_go_no_go_review(text, uuid)`: PUBLIC revoked; anon explicit; authenticated absent; service_role explicit.
- `record_pilot_go_no_go_event(uuid, text, text, uuid)`: PUBLIC revoked; anon explicit; authenticated absent; service_role explicit.
- `update_pilot_go_no_go_review_status(uuid, text, text, uuid)`: PUBLIC revoked; anon explicit; authenticated absent; service_role explicit.
- `record_executive_production_signoff(uuid, text, text, text)`: PUBLIC revoked; anon explicit; authenticated explicit; service_role explicit.

Containment/rollback is manual only: do not restore unsafe browser grants. If a bridge regression blocks a required workflow, keep the browser grants closed, keep the workflow disabled, and repair/review the authenticated Edge allowlist and database dispatcher before a separate controlled Edge deployment.
