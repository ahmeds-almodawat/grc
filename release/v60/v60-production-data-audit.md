# v6.0 Production Data Audit

Generated: 2026-06-19T00:47:42.554Z

Production-blocking findings: 0
Total findings: 4

## Findings

- **medium** FAKE_DATA_TEXT_REVIEW — src\lib\demoMode.ts:8 — `throw new Error(Demo data is disabled for ${feature}. Set VITE_ALLOW_DEMO_DATA=true only in local development.);`
- **medium** FAKE_DATA_TEXT_REVIEW — src\lib\demoMode.ts:16 — `return 'Demo data mode is enabled for local development only. Do not use this data in production.';`
- **medium** FAKE_DATA_TEXT_REVIEW — src\lib\supabaseClient.ts:77 — `// This bridge keeps TypeScript happy and allows emptyRows/demo data to render safely`
- **medium** FAKE_DATA_TEXT_REVIEW — src\components\LiveDataState.tsx:26 — `<strong>{isArabic ? 'وضع البيانات التجريبية مفعّل لبيئة غير إنتاجية.' : 'Demo data mode is enabled for a non-production environment.'}</strong>`
