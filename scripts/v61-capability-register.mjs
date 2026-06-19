import fs from 'node:fs';
import path from 'node:path';

const releaseDir = path.resolve('release', 'v61');
fs.mkdirSync(releaseDir, { recursive: true });

function existsAny(paths) {
  return paths.some((p) => fs.existsSync(path.resolve(p)));
}

const capabilities = [
  {
    area: 'Governance / GRC workflow',
    capability: 'Project, milestone, task, evidence, approval and closure chain',
    artifact_detected: existsAny(['src/lib/grcApi.ts', 'src/pages/GrcControlCenter.tsx', 'src/pages/ExecutiveCommandCenter.tsx']),
    current_claim_level: 'prototype_or_staging_artifact',
    production_status: 'unverified',
    production_evidence_required: 'Executable workflow test against staging Supabase with real roles and audit trail review.'
  },
  {
    area: 'OVR / Quality',
    capability: 'OVR submission, supervisor/HOD review, Quality review, corrective action and closure path',
    artifact_detected: existsAny(['src/pages/quality', 'src/lib/grcApi.ts']),
    current_claim_level: 'prototype_or_staging_artifact',
    production_status: 'unverified',
    production_evidence_required: 'End-to-end OVR test with patient-sensitive-field access restrictions and Quality-only closure proof.'
  },
  {
    area: 'Production data integrity',
    capability: 'No silent mock/demo/fallback rows in production runtime',
    artifact_detected: existsAny(['scripts/v60-production-data-audit.mjs', 'src/lib/liveData.ts']),
    current_claim_level: 'static_audit_pass_possible',
    production_status: 'partially_verified',
    production_evidence_required: 'Empty database browser test and failed-query browser test proving empty/error states, not fictional records.'
  },
  {
    area: 'Authentication',
    capability: 'Login/session shell and protected route access',
    artifact_detected: existsAny(['src/auth', 'src/lib/auth', 'src/components/auth', 'src/pages/Login.tsx']),
    current_claim_level: 'unknown_or_unverified',
    production_status: 'unverified',
    production_evidence_required: 'Anonymous access denied, current user profile loaded, inactive user blocked, role-based navigation confirmed.'
  },
  {
    area: 'RLS / authorization',
    capability: 'Organization/department/persona isolation in Supabase',
    artifact_detected: existsAny(['supabase/migrations']),
    current_claim_level: 'schema_artifact',
    production_status: 'unverified',
    production_evidence_required: 'Executable SQL persona tests for employee, manager, quality, audit, super admin and negative access cases.'
  },
  {
    area: 'Automated testing',
    capability: 'Unit, integration and browser workflow tests',
    artifact_detected: existsAny(['tests', 'e2e', 'playwright.config.ts', 'vitest.config.ts']),
    current_claim_level: 'unknown_or_unverified',
    production_status: 'unverified',
    production_evidence_required: 'CI run with Vitest/RTL/Playwright and disposable Supabase test database.'
  },
  {
    area: 'Backup / restore',
    capability: 'Database, Storage and Auth recovery procedures',
    artifact_detected: existsAny(['scripts/v50-backup-strategy-check.mjs', 'scripts/v50-restore-dryrun-audit.mjs']),
    current_claim_level: 'manual_checklist_artifact',
    production_status: 'unverified',
    production_evidence_required: 'Signed restore dry-run to staging with table counts, Storage sample verification and smoke test.'
  },
  {
    area: 'Arabic / RTL',
    capability: 'Bilingual Arabic/English UI with RTL layout',
    artifact_detected: existsAny(['src/i18n', 'src/i18n/I18nContext.tsx']),
    current_claim_level: 'prototype_or_staging_artifact',
    production_status: 'unverified',
    production_evidence_required: 'Screen-by-screen Arabic QA, untranslated string audit and accessibility review.'
  },
  {
    area: 'Performance / scale',
    capability: '1,000 users / 50 departments readiness',
    artifact_detected: existsAny(['scripts/v50-performance-audit.mjs', 'scripts/v50-generate-scale-seed.mjs']),
    current_claim_level: 'static_or_seed_artifact',
    production_status: 'unverified',
    production_evidence_required: 'Real staging load test, query pagination proof and route lazy-loading browser measurements.'
  }
];

const summary = capabilities.reduce((acc, c) => {
  acc.total += 1;
  acc[c.production_status] = (acc[c.production_status] || 0) + 1;
  return acc;
}, { total: 0 });

const report = {
  generated_at: new Date().toISOString(),
  policy: 'Capabilities must be separated into implemented artifacts versus production-verified evidence.',
  summary,
  capabilities
};

fs.writeFileSync(path.join(releaseDir, 'v61-capability-register.json'), JSON.stringify(report, null, 2) + '\n');
const md = [
  '# v6.1 Real vs Simulated Capability Register',
  '',
  `Generated: ${report.generated_at}`,
  '',
  'This register deliberately marks most capabilities as **unverified** until backed by executable tests or signed staging evidence.',
  '',
  '## Summary',
  '',
  `- Total capabilities: ${summary.total}`,
  `- Partially verified: ${summary.partially_verified || 0}`,
  `- Unverified: ${summary.unverified || 0}`,
  '',
  '## Capabilities',
  '',
  '| Area | Capability | Artifact detected | Claim level | Production status | Evidence required |',
  '|---|---|---:|---|---|---|',
  ...capabilities.map((c) => `| ${c.area} | ${c.capability} | ${c.artifact_detected ? 'yes' : 'no'} | ${c.current_claim_level} | **${c.production_status}** | ${c.production_evidence_required} |`),
  ''
].join('\n');
fs.writeFileSync(path.join(releaseDir, 'v61-capability-register.md'), md);

console.log('v6.1 capability register generated.');
console.log(JSON.stringify(summary, null, 2));
