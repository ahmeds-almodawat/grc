import { exists, writeJson, writeMarkdown, score, statusFromBoolean } from './v54-shared.mjs';

const checks = [
  {
    code: 'BOARDPACK_MIGRATION',
    title: 'Board pack migration exists',
    status: statusFromBoolean(exists('supabase/migrations/036_v54_reports_boardpack_ux_employee_mode.sql'))
  },
  {
    code: 'BOARDPACK_READINESS_VIEW',
    title: 'Board pack readiness view must be queried in Supabase',
    status: 'manual_required'
  },
  {
    code: 'MONTHLY_BOARD_PACK_TEMPLATE',
    title: 'Monthly GRC board pack template seeded',
    status: 'manual_required'
  },
  {
    code: 'BOARD_PACK_OWNER',
    title: 'Board pack owner assigned for weekly/monthly governance meetings',
    status: 'manual_required'
  }
];

const report = { generated_at: new Date().toISOString(), score: score(checks), checks };
writeJson('release/v54-boardpack-audit.json', report);
writeMarkdown('release/V54_BOARDPACK_AUDIT.md', `# v5.4 Board Pack Audit\n\nScore: ${report.score}%\n\n${checks.map((c) => `- ${c.status === 'passed' ? '✅' : c.status === 'manual_required' ? '🟡' : '⚠️'} **${c.code}** — ${c.title} (${c.status})`).join('\n')}`);
console.log('v5.4 board pack audit generated.');
console.table(checks.map(({ code, status }) => ({ code, status })));
