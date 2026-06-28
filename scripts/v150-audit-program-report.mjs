import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v150');
fs.mkdirSync(releaseDir, { recursive: true });

const auditPath = path.join(releaseDir, 'v150-static-audit.json');
const audit = fs.existsSync(auditPath)
  ? JSON.parse(fs.readFileSync(auditPath, 'utf8'))
  : { status: 'not_run', summary: { critical: 0, high: 0, medium: 0, passed: 0, total: 0 } };

const markdown = `# v15.0 Audit Program Execution Pack\n\n## Purpose\n\nThis update strengthens the Audit module into a professional internal audit execution lifecycle instead of only a findings follow-up table.\n\n## Workflow chain\n\nAudit Universe → Annual Audit Plan → Engagement Planning → Workpapers → Evidence Requests → Findings → Management Response → Action Plan Follow-up → Closure → Assurance Reporting\n\n## What was added\n\n- Audit universe panel\n- Annual audit plan panel\n- Engagement planning lifecycle\n- Workpaper checklist\n- Evidence request tracker\n- Finding follow-up context\n- Assurance coverage summary\n- v15 static audit and final proof scripts\n\n## Scope boundaries\n\n- No approval JSON files changed.\n- No Supabase migration required.\n- No proof:all logic changed.\n- No real audit results are claimed.\n- Static/sample workflow data is for controlled UAT only.\n\n## Static audit status\n\n- Status: ${audit.status}\n- Critical failures: ${audit.summary?.critical ?? 0}\n- High failures: ${audit.summary?.high ?? 0}\n- Medium failures: ${audit.summary?.medium ?? 0}\n- Passed checks: ${audit.summary?.passed ?? 0} / ${audit.summary?.total ?? 0}\n\n## Recommendation\n\nUse v15 for controlled UAT of audit lifecycle design. Do not treat this as final audit assurance until real UAT execution, evidence review, and persona proof are complete.\n`;

fs.writeFileSync(path.join(releaseDir, 'v150-audit-program-report.md'), markdown);
console.log('v15.0 audit program report generated.');
