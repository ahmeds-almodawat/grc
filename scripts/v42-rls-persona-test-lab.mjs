import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release');
fs.mkdirSync(releaseDir, { recursive: true });

const personas = [
  { code: 'CEO', role: 'executive', scope: 'global', must: ['view_all_dashboards', 'approve_executive_items', 'view_major_ovr'], must_not: ['bypass_audit_log'] },
  { code: 'GOV_ADMIN', role: 'governance_admin', scope: 'global', must: ['manage_grc_workflows', 'view_risks', 'view_compliance'], must_not: ['delete_audit_logs'] },
  { code: 'QUALITY_MANAGER', role: 'governance_admin', scope: 'department', must: ['review_ovr', 'close_ovr_with_evidence'], must_not: ['close_without_evidence'] },
  { code: 'AUDITOR', role: 'auditor', scope: 'global', must: ['view_audit_findings', 'review_evidence'], must_not: ['self_approve'] },
  { code: 'DEPT_MANAGER', role: 'department_manager', scope: 'department', must: ['view_own_department_projects', 'assign_department_tasks'], must_not: ['view_other_department_employee_tasks'] },
  { code: 'PROJECT_OWNER', role: 'project_owner', scope: 'assigned_only', must: ['update_assigned_project', 'request_approval'], must_not: ['approve_own_project'] },
  { code: 'EMPLOYEE', role: 'employee', scope: 'assigned_only', must: ['view_own_tasks', 'submit_own_ovr', 'upload_assigned_evidence'], must_not: ['view_unassigned_ovr', 'view_other_department_tasks'] },
  { code: 'VIEWER', role: 'viewer', scope: 'department', must: ['read_scoped_reports'], must_not: ['create_or_update_records'] }
];

const matrix = personas.flatMap((p) => [
  { persona: p.code, test_code: `${p.code}_ALLOW`, expected: 'allow', checks: p.must },
  { persona: p.code, test_code: `${p.code}_DENY`, expected: 'deny', checks: p.must_not }
]);

const report = {
  generated_at: new Date().toISOString(),
  status: 'manual_execution_required',
  persona_count: personas.length,
  test_case_count: matrix.length,
  personas,
  matrix,
  hard_stop_rules: [
    'Any employee can view another department OVR: STOP.',
    'Any department manager can view unrelated department users/tasks: STOP.',
    'Any user can self-approve: STOP.',
    'Any OVR can close without Quality/evidence when required: STOP.',
    'Any inactive user can access active workflows: STOP.'
  ]
};
fs.writeFileSync(path.join(releaseDir, 'v42-rls-persona-test-lab.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(releaseDir, 'v42-rls-persona-test-lab.md'), `# v4.2 RLS Persona Test Lab\n\nStatus: **manual execution required**\n\nPersonas: **${personas.length}**\n\nTest cases: **${matrix.length}**\n\n## Personas\n\n${personas.map((p) => `### ${p.code}\n- Role: ${p.role}\n- Scope: ${p.scope}\n- Must allow: ${p.must.join(', ')}\n- Must deny: ${p.must_not.join(', ')}`).join('\n\n')}\n\n## Hard Stop Rules\n\n${report.hard_stop_rules.map((x) => `- ${x}`).join('\n')}\n`);
console.log(`v4.2 RLS persona matrix generated with ${matrix.length} test cases.`);
