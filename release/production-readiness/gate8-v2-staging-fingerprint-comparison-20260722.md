# Gate 8 V2 staging fingerprint comparison

The 31 hosted post-182 catalog records match the Gate 7R semantic contract. Function definitions, indexes, views, RLS states, grants, policies, and ACL boundaries match.

The raw catalog hash differs: expected `5feba35fc324214c45f728f61fb6556aa76cff1a97f470395830e0b8191f1f10`; hosted `78ab27d7b8d86232285e2bf26a2be92f9966aad35cc53812ff208b55eea32c08`.

The complete difference is four policy lines whose role field contains the environment-specific PostgreSQL OID for the same `authenticated` role: synthetic fixture OID 16444 versus hosted staging OID 16485. This is a fingerprint normalization defect, not ACL or RLS drift. All stable policy attributes match, and there are no unexplained differences.

Result: **passed with documented normalization defect**. A future fingerprint revision should serialize role names, not OIDs.
