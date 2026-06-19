import fs from 'fs';
import path from 'path';

const exists = (p) => fs.existsSync(path.resolve(p));
const read = (p) => exists(p) ? fs.readFileSync(path.resolve(p), 'utf8') : '';
const ensureDir = (p) => fs.mkdirSync(path.resolve(p), { recursive: true });

const checks = [
  { id: 'OVR_PAGE_EXISTS', label: 'OVR page exists', pass: exists('src/pages/OVR.tsx') || exists('src/pages/Ovr.tsx') },
  { id: 'OVR_TABLE_EXISTS_IN_MIGRATIONS', label: 'OVR table migration exists', pass: fs.readdirSync('supabase/migrations').some((f) => read(`supabase/migrations/${f}`).includes('create table if not exists public.ovr_reports')) },
  { id: 'V46_MIGRATION_EXISTS', label: 'v4.6 hardening migration exists', pass: exists('supabase/migrations/034_v46_ovr_bilingual_rtl_production_hardening.sql') },
  { id: 'OVR_CHECKLIST_TABLE', label: 'OVR production checklist registry exists', pass: read('supabase/migrations/034_v46_ovr_bilingual_rtl_production_hardening.sql').includes('ovr_production_checklist_templates') },
  { id: 'OVR_QUALITY_CLOSURE_FIELDS', label: 'Quality closure fields added', pass: read('supabase/migrations/034_v46_ovr_bilingual_rtl_production_hardening.sql').includes('quality_manager_id') && read('supabase/migrations/034_v46_ovr_bilingual_rtl_production_hardening.sql').includes('closure_summary') },
  { id: 'OVR_CONFIDENTIAL_TEXT', label: 'OVR confidentiality text appears in source/docs', pass: (read('src/pages/OVR.tsx') + read('docs/V43_OVR_PRODUCTION_WORKFLOW.md')).toLowerCase().includes('confidential') || (read('src/pages/OVR.tsx') + read('docs/V43_OVR_PRODUCTION_WORKFLOW.md')).includes('سري') }
];

const passed = checks.filter(c => c.pass).length;
const report = {
  generated_at: new Date().toISOString(),
  title: 'v4.3 OVR Production Workflow Audit',
  passed,
  total: checks.length,
  score_percent: Math.round((passed / checks.length) * 100),
  checks
};
ensureDir('release');
fs.writeFileSync('release/v43-ovr-production-audit.json', JSON.stringify(report, null, 2));
console.log(`v4.3 OVR production audit: ${passed}/${checks.length} passed (${report.score_percent}%)`);
if (checks.some(c => !c.pass && ['OVR_TABLE_EXISTS_IN_MIGRATIONS','V46_MIGRATION_EXISTS'].includes(c.id))) process.exitCode = 1;
