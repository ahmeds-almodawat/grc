# Gate 13S-R minimal RC3 release manifest

The proposed minimal RC3 stages exactly 32 paths: 30 hashed payload files plus this self-describing JSON/Markdown manifest pair. The Git-normalized 30-file payload is 14,762,414 bytes and has aggregate SHA-256 `ea8973a77268a0dc932949325f3201e49e0bdc20ba7fe5d50eaae4ab8868d34a` under the ordered `(path, sha256, bytes)` contract.

Scope is limited to the canonical fingerprint implementation, adversarial regression test, authoritative Gate 13S postflight inputs, canonical hosted/expected fingerprints, semantic comparison, supersession/binding records, validation evidence, and explicit staging plan. Migrations 001–187, baseline V3 SQL and its original manifest, runtime source, and product behavior are unchanged. Unrelated historical evidence and all local/environment artifacts remain unstaged.
