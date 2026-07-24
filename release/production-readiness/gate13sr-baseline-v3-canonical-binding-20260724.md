# Gate 13S-R baseline V3 canonical binding

Baseline V3 remains byte-identical at `a607d9ff445ee991a80fa5b6c212ff8a2e293910ad91919a19947f7c2b5c1857`; migrations 001–187 are unchanged. The old post-187 expectation `5e5f685f…` was produced by a non-canonical source-text path and is superseded only as postflight evidence.

The canonical PostgreSQL 17.6 replay contract produced `923091c6786e115d20b328ace3c191d71024762fae4564a8d2793ec9a0b8deae` for both hosted staging and the disposable modern-lineage environment, with 26,257 records and zero field-level differences. This binding changes no schema or runtime behavior and requires a minimal RC3 so the corrected tooling, regression tests, and release controls are committed without moving RC2.
