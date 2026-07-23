# Gate 10 staging postflight

Result: **PASS**

- Staging project: `zghsgzrdwbqdrpuxanac`
- Read-only transaction: yes; explicit rollback: yes
- Migration history: 183 once, 184 once, latest 184, no later migration
- Runtime: enforced, state version 5
- Patch 83T/U catalog attestation: `overall_pass = true`
- Migration 183: all nine target tables have RLS enabled and forced; 19 expected policies, no legacy or universal-true policies, and no anon table privileges
- Migration 184: all 39 target functions have fixed safe search paths; none is SECURITY DEFINER; PUBLIC and anon execute counts are zero
- Normalized 77-line catalog fingerprint: exact match

No business, Auth, session, token, email, or credential data was selected. Production was not accessed.
