import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

let failed = false;

function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
}

function assert(pass, message) {
  if (pass) {
    console.log(`✅ ${message}`);
  } else {
    failed = true;
    console.log(`❌ ${message}`);
  }
}

const risks = read('src/pages/Risks.tsx');
const styles = read('src/styles.css');

const diffFiles = spawnSync('git', ['diff', '--name-only'], { encoding: 'utf8' })
  .stdout
  .split(/\r?\n/)
  .map(item => item.trim())
  .filter(Boolean);

const forbiddenChanged = diffFiles.filter(file =>
  file.startsWith('supabase/migrations/')
  || file.startsWith('supabase/functions/')
  || file.startsWith('src/auth/')
  || file === 'src/lib/privilegedAction.ts',
);

assert(forbiddenChanged.length === 0, `No migrations/auth/backend security files changed${forbiddenChanged.length ? `: ${forbiddenChanged.join(', ')}` : ''}`);
assert(risks.includes('risk-detail-modal'), 'Risk detail modal has a scoped compact class');
assert(styles.includes('.modal-card:has(.risk-detail-modal)'), 'Risk detail modal CSS sets a scoped max-width/max-height rule');
assert(/max-height:\s*88dvh/.test(styles), 'Risk detail modal max-height is set to 88dvh');
assert(/width:\s*min\(1040px, 100%\)/.test(styles), 'Risk detail modal max-width is scoped to 1040px');
assert(risks.includes('risk-register-page'), 'Risk Register page root is scoped for compact sizing');
assert(styles.includes('.risk-register-page .table-wrapper'), 'Risk Register tables use bounded, scrollable overflow');
assert(risks.includes('isBootstrapRisk'), 'Risk Register labels bootstrap/seed risk records');
assert(risks.includes('Bootstrap / Seeded'), 'Risk Register renders a Bootstrap / Seeded label');
assert(risks.includes('rows={risks.data || []}'), 'Enterprise risk register still renders all risk rows unfiltered (no silent hiding)');

if (failed) process.exit(1);
