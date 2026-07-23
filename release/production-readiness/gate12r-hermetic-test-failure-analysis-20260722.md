# Gate 12R hermetic-test failure analysis

Three freeze-contract files hashed an ignored Run 003 checkpoint when constructing test-only prior-evidence fixtures. The harness test omitted its browser-configuration adapter, causing the production default to read `.env.staging.local`. Product runtime behavior was not implicated. No hosted call or credential was used.
