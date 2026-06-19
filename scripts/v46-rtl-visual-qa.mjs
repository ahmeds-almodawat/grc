import fs from 'fs';
import path from 'path';

const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
const ensureDir = (p) => fs.mkdirSync(path.resolve(p), { recursive: true });
const css = read('src/styles.css');
const app = read('src/App.tsx') + read('src/components/Layout.tsx') + read('src/i18n/I18nContext.tsx');
const sql = read('supabase/migrations/034_v46_ovr_bilingual_rtl_production_hardening.sql');
const checks = [
  { id: 'DIR_RTL_USAGE', label: 'App/layout sets dir or RTL state', pass: app.includes('dir=') || app.includes('document.documentElement.dir') || app.includes("lang === 'ar'") },
  { id: 'RTL_CSS_SELECTOR', label: 'RTL CSS selectors exist', pass: css.includes('[dir="rtl"]') || css.includes('.rtl') || css.includes(':dir(rtl)') },
  { id: 'LOGICAL_SPACING', label: 'Some logical CSS properties are used', pass: /(margin-inline|padding-inline|inset-inline|text-align:\s*start|text-align:\s*end)/.test(css) },
  { id: 'RESPONSIVE_MEDIA', label: 'Responsive media queries exist', pass: css.includes('@media') },
  { id: 'RTL_QA_SQL', label: 'RTL QA registry exists in migration', pass: sql.includes('rtl_visual_qa_items') },
  { id: 'OVR_PRINT_QA_ITEM', label: 'OVR print QA item seeded', pass: sql.includes('ovr_print') }
];
const passed = checks.filter(c => c.pass).length;
const report = { generated_at: new Date().toISOString(), title: 'v4.6 RTL Visual QA Audit', passed, total: checks.length, score_percent: Math.round((passed/checks.length)*100), checks };
ensureDir('release');
fs.writeFileSync('release/v46-rtl-visual-qa.json', JSON.stringify(report, null, 2));
console.log(`v4.6 RTL visual QA audit: ${passed}/${checks.length} passed (${report.score_percent}%)`);
if (passed < 4) process.exitCode = 1;
