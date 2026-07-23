# Gate 12 clean candidate validation

`npm ci`, 56 focused tests, TypeScript, Deno Edge check, production build, 25/25 Patch 83U Playwright tests, SQL governance, disposable baseline contracts, dependency audit and classified secret scan passed. The full unit suite failed: 723/1,195 passed and 472 failed across four files. The failures require an ignored checkpoint capture and `.env.staging.local`; neither may be included in a release candidate. Remediation must replace them with committed synthetic fixtures and process-only test configuration, without weakening fail-closed checks.
