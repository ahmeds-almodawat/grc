# Patch 83R lifecycle behavior

Rename trims both names, permits either Arabic or English to be populated, limits each to 180 characters, rejects normalized active-name conflicts in the organization, rejects archived targets, preserves the code, and records old/new names plus request identifier.

Archive requires a reason and returns counts for active users, open work, policies, SOPs, training, evidence, risks, audits, and other active references. Active users require a different active successor in the same organization. Their profile department is moved transactionally, incompatible unit scope is cleared, and the successor division is applied. Department-scoped active role assignments are deactivated rather than moved or deleted to avoid silently expanding authority. Any failure rolls back the full operation.

Archive then sets `is_active = false` and records metadata. Restore preserves the same row and code, checks active normalized name/code conflicts, clears current archive metadata, and records the prior archive state in `audit_logs`. Archived rows are hidden by default, visually labeled in the explicit archived view, and remain available to historical reports and lifecycle history.

There is no hard-delete lifecycle action.
