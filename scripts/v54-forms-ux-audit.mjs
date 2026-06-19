import { exists, writeJson, writeMarkdown, score, statusFromBoolean } from './v54-shared.mjs';

const checks = [
  {
    code: 'STYLE_FILE_EXISTS',
    title: 'Global style file exists',
    status: statusFromBoolean(exists('src/styles.css'))
  },
  {
    code: 'SAVE_CANCEL_VISIBILITY',
    title: 'Save/cancel visibility requires screen-by-screen manual QA',
    status: 'manual_required'
  },
  {
    code: 'OVR_CONFIDENTIALITY_VISUAL',
    title: 'OVR confidentiality banners require visual QA',
    status: 'manual_required'
  },
  {
    code: 'MOBILE_FORM_REVIEW',
    title: 'Mobile/tablet form behavior requires manual QA',
    status: 'manual_required'
  }
];

const report = { generated_at: new Date().toISOString(), score: score(checks), checks };
writeJson('release/v54-forms-ux-audit.json', report);
writeMarkdown('release/V54_FORMS_UX_AUDIT.md', `# v5.4 Forms UX Audit\n\nScore: ${report.score}%\n\n${checks.map((c) => `- ${c.status === 'passed' ? '✅' : c.status === 'manual_required' ? '🟡' : '⚠️'} **${c.code}** — ${c.title} (${c.status})`).join('\n')}`);
console.log('v5.4 forms and modal UX audit generated.');
console.table(checks.map(({ code, status }) => ({ code, status })));
