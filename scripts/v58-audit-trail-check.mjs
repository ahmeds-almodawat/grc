import fs from 'fs';
import path from 'path';

const outDir = path.resolve('release/v58');
fs.mkdirSync(outDir, { recursive: true });
const controls = [
  { code: 'AUD_PROJECT_STATUS', area: 'projects', event: 'project_status_changed' },
  { code: 'AUD_TASK_CLOSURE', area: 'tasks', event: 'task_closed_or_evidence_accepted' },
  { code: 'AUD_OVR_WORKFLOW', area: 'ovr', event: 'ovr_workflow_transition' },
  { code: 'AUD_APPROVAL_DECISION', area: 'approvals', event: 'approval_decision' },
  { code: 'AUD_ROLE_CHANGE', area: 'access_control', event: 'role_changed' },
  { code: 'AUD_EXPORT_BACKUP', area: 'backup_export', event: 'export_or_backup_created' }
];
const report = {
  generated_at: new Date().toISOString(),
  controls,
  proof_question: 'For any closed item, can we show who created, changed, approved, accepted evidence, and closed it?'
};
fs.writeFileSync(path.join(outDir, 'v58-audit-trail-check.json'), JSON.stringify(report, null, 2));
console.log('v5.8 audit trail check generated:', path.join('release', 'v58', 'v58-audit-trail-check.json'));
console.table(controls);
