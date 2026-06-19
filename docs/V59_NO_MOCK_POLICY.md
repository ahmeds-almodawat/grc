# v5.9 No-Mock Policy

Production rule:

> The live platform must not silently show mock, demo, fallback, placeholder, or sample data when Supabase is unavailable or when a real query fails.

## Allowed only in these cases

Mock/fallback data is allowed only when:

1. The file is a test script, seed generator, documentation, or demo-only artifact.
2. The code is clearly protected by a development flag.
3. The file is explicitly listed in the allowlist.
4. The UI clearly labels the data as demo/test data.

## Not allowed in production UI

- Silent `fallbackData` on executive dashboard
- Demo rows in real operational pages
- Hardcoded fake users/departments/projects unless clearly seed/test only
- Mock OVR incidents in production OVR queue
- Placeholder risk/compliance/audit records shown as real

## Required replacement behavior

Instead of silent fallback data, production screens should show:

- Empty state: “No records found”
- Connection state: “Supabase is not configured”
- Error state: “Could not load data”
- Setup action: “Configure Supabase / run migrations”

## Recommended phased cleanup

1. Audit mock data.
2. Classify each finding as production-blocking, dev-only, docs-only, or allowed fallback.
3. Replace production-blocking fallback with explicit empty/error states.
4. Run `npm run no-mock:fail`.
5. Pilot only after zero production-blocking findings.
