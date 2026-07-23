# Production Gate 8 V2 staging postflight

Result: **passed**

The exact reviewed postflight ran against staging in a read-only transaction and explicitly rolled back. Migration history contains 178–182 exactly once in order, latest migration is 182, no later migration exists, and each migration's principal objects are present.

- Duplicate expression-key groups: 0 / 0
- Activation view: security invoker and security barrier enabled; authenticated SELECT only
- Runtime action tables: RLS enabled and forced; browser DML grants and write policies absent
- Catalog attestation: `overall_pass=true`, safe metadata only, 24 Edge service RPC contracts
- Last-Super-Admin recovery: owner-only implementation and wrapper binding present; synthetic helper absent
- Legacy tables: 18 present, 18 RLS enabled/forced, 0 browser-granted, 0 policies
- Runtime: enforced, state version 5, contracts compatible

No business records were selected. Production was not accessed.
