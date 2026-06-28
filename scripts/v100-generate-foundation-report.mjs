#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const releaseDir = path.resolve('release/v100');
fs.mkdirSync(releaseDir, { recursive: true });

const generatedAt = new Date().toISOString();
const moduleMap = [
  ['Unified CAPA', 'capa_cases + capa_action_items', 'OVR, risk, control test, audit finding, compliance, policy, UAT issue sources can converge into CAPA.'],
  ['Risk Register lifecycle', 'risks extended', 'Risk statement, causes, consequences, appetite, treatment owner/due date, KRI/control/assurance summaries.'],
  ['Controls Library', 'control_library_items + risk_control_mappings', 'Reusable controls can be mapped to multiple risks and obligations.'],
  ['Control Testing', 'control_tests', 'Design/operating effectiveness, samples, exceptions, evidence summaries, remediation linkage.'],
  ['Compliance Obligations', 'compliance_obligations + compliance_obligation_mappings', 'Requirements mapped to controls, risks, evidence, policies, and CAPA.'],
  ['Issue/Finding Register', 'grc_issue_register', 'Shared register for OVR gaps, risk issues, control gaps, audit findings, compliance gaps and UAT bugs.'],
  ['Audit Program Foundation', 'audit_universe_items + audit_engagements + audit_workpapers', 'Audit universe, engagements, workpapers, fieldwork/reporting/follow-up statuses.'],
  ['Executive Views', 'v100_* views', 'Risk/control/CAPA dashboard, overdue CAPA actions, control-test effectiveness summary.'],
];

const report = `# v10.0 Unified CAPA + Risk-Control Foundation Report\n\n- Generated: ${generatedAt}\n- Status: **patch generated / static-audit ready**\n- Production readiness: **not asserted**\n- Approval gates: **unchanged**\n- Patient identifiers: **not required**\n\n## What v10.0 adds\n\n| Module | Database objects | Purpose |\n|---|---|---|\n${moduleMap.map(([module, objects, purpose]) => `| ${module} | \`${objects}\` | ${purpose} |`).join('\n')}\n\n## Safe scope\n\nThis patch strengthens the GRC foundation while keeping light production scope controlled. It does not claim full enterprise GRC production readiness by itself.\n\nRecommended operational scope after UAT and approvals:\n\n1. OVR / Quality workflow.\n2. CAPA from OVR, audit findings, control-test failures, risk and compliance gaps.\n3. Risk register with treatment and appetite review.\n4. Controls library and evidence-backed control testing.\n5. Audit and compliance foundation in controlled pilot mode.\n\n## Non-goals\n\n- No fake approvals.\n- No v66 bypass.\n- No service-role key in browser.\n- No patient identifiers.\n- No full vendor risk / BCP / training rollout yet.\n\n## Recommended validation commands\n\n\`\`\`powershell\nnpm run v100:foundation-audit\nnpm run v100:foundation-report\nnpm run v100:final-proof\nnpm run typecheck\nnpm run build\nnpm run pilot:uat-readiness\nnpm run proof:all\n\`\`\`\n\n## Manual review checklist\n\n- [ ] Apply migration to local Supabase first.\n- [ ] Confirm new tables have RLS enabled.\n- [ ] Confirm no delete grants are exposed to normal authenticated users.\n- [ ] Login as Governance Admin and verify risk/control/CAPA records are visible only in allowed scope.\n- [ ] Login as Auditor and verify audit surfaces behave as intended.\n- [ ] Login as Employee and verify no admin/global data leakage.\n- [ ] Confirm v66 still blocks until real approval files are completed.\n`;

const checklist = `# v10.0 Manual UAT Checklist\n\n- Generated: ${generatedAt}\n- Data boundary: synthetic/non-confidential first\n\n## CAPA\n\n- [ ] Create CAPA from manual source.\n- [ ] Link CAPA to an OVR.\n- [ ] Add containment/corrective/preventive action items.\n- [ ] Mark action delayed and require delay reason.\n- [ ] Confirm closure requires verification/effectiveness notes by process.\n\n## Risk and controls\n\n- [ ] Create risk with risk statement, causes, consequences and appetite.\n- [ ] Add reusable control library item.\n- [ ] Map control to risk.\n- [ ] Create design effectiveness test.\n- [ ] Create operating effectiveness test with sample and exceptions.\n- [ ] Confirm failed control test can link to CAPA.\n\n## Compliance and audit\n\n- [ ] Add compliance obligation.\n- [ ] Map obligation to risk/control/evidence/policy.\n- [ ] Add audit universe item.\n- [ ] Create audit engagement.\n- [ ] Add workpaper and finding.\n- [ ] Link finding to CAPA.\n\n## Security checks\n\n- [ ] Normal employee cannot see unrelated organization records.\n- [ ] External synthetic user cannot see primary organization data.\n- [ ] Auditor access follows intended policy.\n- [ ] Scenario Lab remains pilot/admin only.\n`;

fs.writeFileSync(path.join(releaseDir, 'v100-foundation-report.md'), report);
fs.writeFileSync(path.join(releaseDir, 'v100-uat-checklist.md'), checklist);
console.log('v10.0 foundation reports generated.');
console.log(JSON.stringify({ report: 'release/v100/v100-foundation-report.md', checklist: 'release/v100/v100-uat-checklist.md' }, null, 2));
