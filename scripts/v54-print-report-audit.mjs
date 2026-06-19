import { exists, writeJson, writeMarkdown, score, statusFromBoolean } from './v54-shared.mjs';

const checks = [
  {
    code: 'PRINT_CENTER_PAGE',
    title: 'Reports UX Employee Center page exists',
    status: statusFromBoolean(exists('src/pages/ReportsUxEmployeeCenter.tsx'))
  },
  {
    code: 'V54_MIGRATION_EXISTS',
    title: 'v5.4 reports migration exists',
    status: statusFromBoolean(exists('supabase/migrations/036_v54_reports_boardpack_ux_employee_mode.sql'))
  },
  {
    code: 'EXEC_REPORT_CATALOG',
    title: 'Print report catalog can be verified in Supabase after migration',
    status: 'manual_required'
  },
  {
    code: 'BILINGUAL_PRINT_REVIEW',
    title: 'Arabic and English print labels need final visual QA',
    status: 'manual_required'
  }
];

const report = {
  generated_at: new Date().toISOString(),
  score: score(checks),
  checks
};

writeJson('release/v54-print-report-audit.json', report);
writeMarkdown('release/V54_PRINT_REPORT_AUDIT.md', `# v5.4 Print Report Audit\n\nScore: ${report.score}%\n\n${checks.map((c) => `- ${c.status === 'passed' ? '✅' : c.status === 'manual_required' ? '🟡' : '⚠️'} **${c.code}** — ${c.title} (${c.status})`).join('\n')}`);
console.log('v5.4 print report audit generated.');
console.table(checks.map(({ code, status }) => ({ code, status })));
