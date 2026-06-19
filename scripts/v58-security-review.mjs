import fs from 'fs';
import path from 'path';

const outDir = path.resolve('release/v58');
fs.mkdirSync(outDir, { recursive: true });
const checks = [
  { code: 'SEC_SUPER_ADMIN', severity: 'critical', title: 'Super admin accounts reviewed and minimized' },
  { code: 'SEC_INACTIVE_USERS', severity: 'critical', title: 'Inactive users have no active roles' },
  { code: 'SEC_EMPLOYEE_SCOPE', severity: 'critical', title: 'Employees cannot access global or unrelated department data' },
  { code: 'SEC_OVR_CONFIDENTIAL', severity: 'critical', title: 'OVR confidentiality and role restrictions verified' },
  { code: 'SEC_EXPORT_ACCESS', severity: 'high', title: 'Export and backup access limited to authorized roles' },
  { code: 'SEC_EVIDENCE_ACCESS', severity: 'high', title: 'Evidence file access reviewed by role and scope' }
];
const report = {
  generated_at: new Date().toISOString(),
  checks,
  stop_rule: 'Any critical failed security check blocks pilot/company rollout.'
};
fs.writeFileSync(path.join(outDir, 'v58-security-review.json'), JSON.stringify(report, null, 2));
console.log('v5.8 security review report generated:', path.join('release', 'v58', 'v58-security-review.json'));
console.table(checks);
