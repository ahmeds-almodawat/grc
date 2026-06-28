import fs from 'node:fs';
import path from 'node:path';

const releaseDir = path.resolve('release/v110');
fs.mkdirSync(releaseDir, { recursive: true });
const generatedAt = new Date().toISOString();

const modules = [
  ['Policy & Document Control', 'Documents, versions, review dates, approval status, linked risks/controls/obligations, attestation requirement.'],
  ['Policy Attestation', 'User/department acknowledgements, overdue status, waiver reason, due dates.'],
  ['Training & Compliance Learning', 'Courses, recurring assignments, completion status, evidence link.'],
  ['Third-Party / Vendor Risk', 'Vendor criticality, data access level, assessment cadence, inherent/residual risk, linked issues/CAPA.'],
  ['KRI / KPI Monitoring', 'KRI definitions, measurements, thresholds, trend, red/amber/green ratings.'],
  ['Regulatory Change Management', 'Source, effective date, impact, obligation/control/policy mapping, action tracking.'],
  ['Risk Acceptance / Exceptions', 'Temporary deviations, policy/control exceptions, compensating controls, expiry dates.'],
  ['Business Continuity / Resilience', 'Business impact process register, RTO/RPO, continuity plans, drills/exercises.'],
  ['Audit Follow-up', 'Finding/CAPA/issue follow-up reviews, management update, validation result.'],
  ['Board Pack Readiness', 'Security-invoker views summarizing maturity, overdue items, high risk vendors, red KRIs.']
];

const report = `# v11.0 Enterprise GRC Program Suite Report\n\n- Generated: ${generatedAt}\n- Status: **controlled enterprise foundation ready for UAT after migration apply**\n- Production readiness: **not asserted**\n- Patient/confidential data requirement: **none**\n\n## Modules added\n\n${modules.map(([name, desc], i) => `${i + 1}. **${name}** — ${desc}`).join('\n')}\n\n## Operating model\n\nThis pack extends v10.0 rather than replacing it. v10.0 created the CAPA/risk-control foundation. v11.0 adds the enterprise program layer around it: policy, attestation, training, vendor risk, KRI, regulatory change, exceptions, BCP, audit follow-up, and board reporting readiness.\n\n## Safety controls\n\n- New tables have RLS enabled.\n- Authenticated users receive select/insert/update only; no delete grant is introduced.\n- Executive/security views are declared with security_invoker.\n- No service-role browser usage is introduced.\n- The v66 human approval gate is not modified or bypassed.\n\n## Manual review required\n\n- Confirm the migration applies cleanly after v10.0 in local Docker Supabase.\n- Confirm representative role visibility for super_admin, governance_admin, compliance_officer, auditor, department_manager, employee, viewer, and external-denial users.\n- Confirm Arabic/RTL labels once UI pages are later added for these data objects.\n- Keep this as controlled UAT until real Management/Admin, IT, and Quality approvals are completed.\n`;

fs.writeFileSync(path.join(releaseDir, 'v110-enterprise-report.md'), report);
console.log('v11.0 enterprise report generated.');
console.log(JSON.stringify({ report: 'release/v110/v110-enterprise-report.md' }, null, 2));
