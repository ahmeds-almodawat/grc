import { exists, writeJson, writeMarkdown, score, statusFromBoolean } from './v54-shared.mjs';

const checks = [
  {
    code: 'EMPLOYEE_MODE_MIGRATION',
    title: 'Employee simple mode migration exists',
    status: statusFromBoolean(exists('supabase/migrations/036_v54_reports_boardpack_ux_employee_mode.sql'))
  },
  {
    code: 'MY_TASKS_TILE',
    title: 'My Tasks tile configured after seed',
    status: 'manual_required'
  },
  {
    code: 'MY_OVR_TILE',
    title: 'My OVR Submissions tile configured after seed',
    status: 'manual_required'
  },
  {
    code: 'EMPLOYEE_RLS_TEST',
    title: 'Employee mode must be tested with assigned-only RLS persona',
    status: 'manual_required'
  }
];

const report = { generated_at: new Date().toISOString(), score: score(checks), checks };
writeJson('release/v54-employee-mode-audit.json', report);
writeMarkdown('release/V54_EMPLOYEE_MODE_AUDIT.md', `# v5.4 Employee Simple Mode Audit\n\nScore: ${report.score}%\n\n${checks.map((c) => `- ${c.status === 'passed' ? '✅' : c.status === 'manual_required' ? '🟡' : '⚠️'} **${c.code}** — ${c.title} (${c.status})`).join('\n')}`);
console.log('v5.4 employee simple mode audit generated.');
console.table(checks.map(({ code, status }) => ({ code, status })));
