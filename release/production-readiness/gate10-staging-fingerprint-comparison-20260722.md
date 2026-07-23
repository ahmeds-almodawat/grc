# Gate 10 hosted fingerprint comparison

Result: **EXACT MATCH**

The hosted staging catalog after migrations 183–184 produced all 77 canonical schema-only lines with zero mismatches. The normalized catalog SHA-256 is `15984ffb01170702380a6c1e92c0636faffc47e0958367f64323acf0584c67bb`, and the deterministic fingerprint-file SHA-256 is `8dcd166ad7e53556369cad8f5681526adfb35317d2b92b606e7d213ddf4dcb09`.

The comparison covered the nine hardened tables, 19 policies, ten dependent views, and 39 hardened functions. It used metadata only inside a read-only transaction followed by rollback.
