# Gate 11R post-185 catalog comparison

The hosted staging catalog and the disposable post-185 catalog are exactly equal after the same proven PostgreSQL 17.6 single-parse dump roundtrip and creation-time default-ACL neutralization used by Gate 11. Both contain 12,488 canonical statements and produce catalog SHA-256 `edac07deb655aba711cd2bc7e834010449be42f36f27863326ce0a41d22a3485`.

The statement-set difference is zero in both directions. No relation, RLS, ACL, policy, function, search-path, index, or constraint drift remains. The original direct-dump fingerprints are preserved as historical capture artifacts; they were not used to claim equality.

Production was not accessed.
