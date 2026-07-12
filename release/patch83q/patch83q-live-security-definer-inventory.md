# Patch 83Q live SECURITY DEFINER inventory

- Linked project: `zbrjjecpsrzposhuarcn`
- Evidence source: schema-only live dump; contains table data: false
- Public SECURITY DEFINER total: 383
- Browser-role executable before migration 170: 6
- Browser-role executable after migration 170: 2
- Confirmed unsafe privileged writes before migration: 4
- Confirmed unsafe privileged writes after migration: 0
- Verified read-only identity/RLS helpers: 2
- Managed-schema observations: 5, reported separately

The exact original six signatures and ACL-source distinctions are in `patch83q-function-classification.md`. The machine-readable JSON is the fresh post-migration inventory. The other 381 post-migration functions are not browser-executable findings.
