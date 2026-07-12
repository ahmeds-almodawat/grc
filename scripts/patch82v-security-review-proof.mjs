import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
const results = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`✅ ${name}`);
    results.push({ name, pass: true, detail });
  } else {
    failed++;
    console.error(`❌ ${name}`);
    if (detail) console.error(`   ${detail}`);
    results.push({ name, pass: false, detail });
  }
}

const packageJson = fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8');
check('package.json contains patch82v:proof', packageJson.includes('patch82v:proof'));

const mdPath = path.join(rootDir, 'release/patch82v/patch82v-security-review.md');
check('release/patch82v/patch82v-security-review.md exists', fs.existsSync(mdPath));

const jsonPath = path.join(rootDir, 'release/patch82v/patch82v-security-review.json');
check('release/patch82v/patch82v-security-review.json exists', fs.existsSync(jsonPath));

if (fs.existsSync(mdPath)) {
  const mdContent = fs.readFileSync(mdPath, 'utf8');
  check('The report includes RLS policy review section', mdContent.includes('RLS policy review'));
  check('The report includes Service-role review section', mdContent.includes('Service-role review'));
  check('The report includes CORS review section', mdContent.includes('CORS review'));
  check('The report includes Privileged action review section', mdContent.includes('Privileged action review'));
  check('The report includes Frontend access review section', mdContent.includes('Frontend access review'));
  check('The report includes Recommended remediation sequence section', mdContent.includes('Recommended remediation sequence'));
  
  const noForbidden = !mdContent.toLowerCase().includes('system is production ready') &&
                      !mdContent.toLowerCase().includes('go-live complete') &&
                      !mdContent.toLowerCase().includes('production launched') &&
                      !mdContent.toLowerCase().includes('transition_to_live_operations') &&
                      !mdContent.toLowerCase().includes('platform is secure');
  check('Forbidden claims are absent', noForbidden);
} else {
  check('The report includes all sections', false, 'MD file missing');
  check('Forbidden claims are absent', false, 'MD file missing');
}

if (fs.existsSync(jsonPath)) {
  const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const hasSeverity = jsonContent.findings.every(f => f.severity);
  const hasId = jsonContent.findings.every(f => f.id);
  check('The JSON report includes severity fields and finding ids', hasSeverity && hasId);
} else {
  check('The JSON report includes severity fields and finding ids', false, 'JSON file missing');
}

import { execSync } from 'child_process';
const gitStatus = execSync('git status --porcelain').toString();
const noModifiedBackend = !gitStatus.includes('supabase/migrations') &&
                          !gitStatus.includes('supabase/functions') &&
                          !gitStatus.includes('src/lib/privilegedAction.ts');
check('Confirm no files under backend/security paths are modified', noModifiedBackend);

const noModifiedFrontend = !gitStatus.includes('src/auth/authAccess.ts') &&
                           !gitStatus.includes('src/App.tsx') &&
                           !gitStatus.includes('src/components/Layout.tsx');
check('Confirm src/auth/authAccess.ts, src/App.tsx, and src/components/Layout.tsx are not modified', noModifiedFrontend);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed.');
}
