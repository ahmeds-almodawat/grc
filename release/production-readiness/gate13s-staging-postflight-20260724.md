# Gate 13S staging postflight

The one authorized staging migration attempt applied 186 and 187 exactly once. Read-only SQL with rollback confirmed ceiling 187, modern lineage, enforced runtime/state 5, compatible Edge/frontend contracts, passing catalog attestations, no invalid active role assignment, and no pending or recovery state. The designated Super Admin remains active at DB/Auth version 1 with `super_admin/global`; no mandatory rotation was introduced. Aggregate session and unrevoked-refresh counts are both zero.

Security Advisor has no Critical or High application finding. It reports the three accepted Patch 83U warnings and 20 informational deny-all/no-policy tables; two of those informational entries are the new, intentionally browser-closed bridge evidence tables.

The live schema-only dump produced canonical hash `280a2848439f820780d2d67572b57b490162d86ab330fa297e7673231e566559`, which does not equal the frozen expected hash `5e5f685f3d9af33ed98c6cf8436d98e1c63f0d4bc82b98d0bb45d9d3d4ac36f7`. Core object-count deltas from the authoritative post-185 hosted fingerprint exactly match migration 186–187 additions, but literal hash equality is mandatory. Gate 13S therefore stops before deployment authorization.
