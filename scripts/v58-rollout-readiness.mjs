import fs from 'fs';
import path from 'path';

const outDir = path.resolve('release/v58');
fs.mkdirSync(outDir, { recursive: true });
const waves = [
  { wave: 1, name: 'Pilot wave', users: 75, departments: 5 },
  { wave: 2, name: 'Department manager wave', users: 200, departments: 15 },
  { wave: 3, name: 'Core departments wave', users: 400, departments: 25 },
  { wave: 4, name: 'Company-wide completion wave', users: 325, departments: 50 }
];
const rollout = {
  generated_at: new Date().toISOString(),
  waves,
  rule: 'Do not onboard all 1,000 users in one day. Each wave requires support coverage, training status, and blocker review.',
  required_before_each_wave: [
    'User import reviewed',
    'Department manager trained',
    'Employee quick guide shared',
    'Support owner assigned',
    'Known blockers resolved or formally accepted',
    'Backup/export package created before wave'
  ]
};
fs.writeFileSync(path.join(outDir, 'v58-rollout-readiness.json'), JSON.stringify(rollout, null, 2));
console.log('v5.8 rollout readiness report generated:', path.join('release', 'v58', 'v58-rollout-readiness.json'));
console.table(waves);
