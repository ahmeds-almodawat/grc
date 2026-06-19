# v5.9 Mock Data Removal Plan

This plan is generated automatically. Review each item before changing production behavior.

## Recommended replacement patterns

1. Replace silent fallback arrays with empty state UI.
2. Replace demo dashboard values with Supabase-backed views.
3. If demo data is needed for training, protect it behind `VITE_ALLOW_DEMO_DATA=true` and show a visible demo banner.
4. Never show fake OVR/risk/compliance records in production mode.

## Blocking files

### src/data/mockData.ts

Findings: 32

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/i18n/I18nContext.tsx

Findings: 2

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/automationApi.ts

Findings: 23

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/commandCenterApi.ts

Findings: 41

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/consolidationApi.ts

Findings: 13

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/enterpriseApi.ts

Findings: 17

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/finalizationApi.ts

Findings: 8

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/grcApi.ts

Findings: 173

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/hardeningApi.ts

Findings: 14

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/onboardingApi.ts

Findings: 9

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/operationsApi.ts

Findings: 29

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/performanceApi.ts

Findings: 18

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/pilotOpsApi.ts

Findings: 15

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/productionProofApi.ts

Findings: 11

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/productionReadinessApi.ts

Findings: 26

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/releaseOpsApi.ts

Findings: 30

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/securityApi.ts

Findings: 23

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/stabilizationApi.ts

Findings: 16

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/supabaseClient.ts

Findings: 1

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/testingApi.ts

Findings: 20

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/v35ConsolidationApi.ts

Findings: 5

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/lib/v50ScaleBackupApi.ts

Findings: 11

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/pages/BackupHealthCheck.tsx

Findings: 1

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.

### src/pages/NoMockAutoTestCenter.tsx

Findings: 4

Suggested action:
- Inspect fallback/demo/mock constants and remove them from production-visible paths.
- Change data loaders to return explicit `{ data: [], error, source: "real" }` empty/error states.
- If the file is truly test-only, add a clear development guard and document it.
