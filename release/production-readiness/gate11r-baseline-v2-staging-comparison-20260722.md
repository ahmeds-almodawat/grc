# Gate 11R baseline V2/staging comparison

After a single PostgreSQL 17.6 parse/dump normalization round trip with platform default ACLs neutralized consistently, baseline V2 and hosted staging each produced 12,488 canonical statements and the same SHA-256: `edac07deb655aba711cd2bc7e834010449be42f36f27863326ce0a41d22a3485`.

There are no relation, RLS, policy, ACL, function, search-path, index, constraint, or statement-set differences. No table data was compared or captured.
