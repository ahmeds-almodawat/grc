import fs from 'fs';
import path from 'path';

const outDir = path.resolve('release/v58');
fs.mkdirSync(outDir, { recursive: true });
const pilot = {
  generated_at: new Date().toISOString(),
  pilot_target: { users: 75, departments: 5, duration_days: 10 },
  required_personas: ['Executive', 'Governance Admin', 'Quality Manager', 'Department Manager', 'Employee'],
  acceptance_checks: [
    'Pilot users imported and activated',
    'RLS persona tests passed for pilot users',
    'OVR workflow tested end-to-end',
    'Evidence upload and approval tested',
    'Export/backup package generated before pilot',
    'Pilot issue triage owner assigned'
  ],
  decision_rule: 'No critical permission, OVR, or backup blockers before pilot go-live.'
};
fs.writeFileSync(path.join(outDir, 'v58-pilot-readiness.json'), JSON.stringify(pilot, null, 2));
console.log('v5.8 pilot readiness report generated:', path.join('release', 'v58', 'v58-pilot-readiness.json'));
console.table(pilot.acceptance_checks.map((check, index) => ({ step: index + 1, check })));
