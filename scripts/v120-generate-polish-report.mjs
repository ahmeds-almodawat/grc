import fs from 'node:fs';
import path from 'node:path';
const releaseDir = path.join('release', 'v120');
fs.mkdirSync(releaseDir, { recursive: true });
const generatedAt = new Date().toISOString();
const modules = [
  ['Workspace Command Layer', 'Workspace/module health, dashboard tiles, saved views, and operational navigation polish.'],
  ['Data Quality Command', 'Data-quality rules, findings, severity, remediation ownership, and board summary views.'],
  ['Workflow SLA Watch', 'SLA policies/events for OVR, CAPA, control testing, and governance workflows.'],
  ['UX Feedback + Polish Backlog', 'Structured user feedback, backlog categories, target releases, and acceptance criteria.'],
  ['Help + Glossary', 'Bilingual help articles and GRC term definitions for user adoption.'],
  ['Release Readiness + Executive Narrative', 'Release checks, board-ready narrative sections, decision/action log, and adoption metrics.']
];
const content = `# v12.0 Operational Polish + Data Quality Command Suite\n\n- Generated: ${generatedAt}\n- Status: **controlled UAT ready after local migration apply**\n- Production readiness: **not asserted**\n- Patient/confidential data requirement: **none**\n\n## What this pack adds\n\n${modules.map(([name, description], i) => `${i + 1}. **${name}** — ${description}`).join('\n')}\n\n## Polish focus\n\n- Cleaner program workspace model for Quality, Risk/Controls, and Enterprise GRC.\n- Optional CSS polish tokens for premium cards, KPI grids, bilingual labels, status pills, and executive narrative blocks.\n- Type-safe polish configuration file for future UI pages without changing existing routes.\n- Data-quality and SLA tables so the next UI iteration can show what is missing, overdue, or weak instead of relying on static comments.\n\n## Safety boundaries\n\n- The migration avoids optional table references such as \`evidence_items\`.\n- No delete grant is introduced.\n- RLS is enabled on all v12.0 tables.\n- Views use \`security_invoker=true\`.\n- v66 human approval gate remains unchanged.\n\n## Recommended manual UAT\n\n1. Apply the migration after v11.0.1 hotfix.\n2. Confirm \`v120_workspace_health_summary\`, \`v120_data_quality_board\`, and \`v120_executive_readiness_overview\` open in Supabase Studio.\n3. Add one synthetic feedback item and one polish backlog item.\n4. Confirm external test user cannot access primary organization records through normal app/API paths.\n5. Keep real patient identifiers and confidential OVR details out of this pilot.\n`;
fs.writeFileSync(path.join(releaseDir, 'v120-polish-report.md'), content);
console.log('v12.0 polish report generated.');
console.log(JSON.stringify({ report: 'release/v120/v120-polish-report.md' }, null, 2));
