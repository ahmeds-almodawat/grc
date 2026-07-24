# Gate 13S-R input verification

RC2 local HEAD, remote branch and tag all resolve to `578315455642a1c1d006eb77d1f2b089cd41e6a6`. The payload/control, migrations 186–187 and immutable baseline V3 hashes match their committed contracts. Staged and deleted tracked counts are zero and `git diff --check` passes.

Read-only staging SQL with rollback confirmed migration ceiling 187, migrations 186 and 187 once each, modern lineage, enforced runtime/state 5, both attestations passing, and the designated Super Admin unchanged at active DB/Auth 1/1 with `super_admin/global`. No migration was rerun and production was not accessed.
