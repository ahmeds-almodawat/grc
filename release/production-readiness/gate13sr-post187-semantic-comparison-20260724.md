# Gate 13S-R post-187 semantic comparison

Hosted staging and the disposable modern post-187 environment each produced 26,257 canonical records and identical SHA-256 `923091c6786e115d20b328ace3c191d71024762fae4564a8d2793ec9a0b8deae`.

There are zero field-level differences: no missing object, RLS/policy drift, ACL/grant drift, function/signature/search-path drift, index/constraint drift, lineage/attestation drift or other semantic drift. The original discrepancy was a normalization implementation defect, not catalog drift.
