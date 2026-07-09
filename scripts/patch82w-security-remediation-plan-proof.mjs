import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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
check('package.json contains patch82w:proof', packageJson.includes('patch82w:proof'));

const mdPath = path.join(rootDir, 'release/patch82w/patch82w-security-remediation-plan.md');
check('release/patch82w/patch82w-security-remediation-plan.md exists', fs.existsSync(mdPath));

const jsonPath = path.join(rootDir, 'release/patch82w/patch82w-security-remediation-plan.json');
check('release/patch82w/patch82w-security-remediation-plan.json exists', fs.existsSync(jsonPath));

if (fs.existsSync(mdPath)) {
  const mdContent = fs.readFileSync(mdPath, 'utf8');
  check('Plan references Patch 82V source report', mdContent.includes('82V'));
  check('Plan includes Prioritized remediation sequence section', mdContent.includes('Prioritized remediation sequence') || mdContent.includes('Prioritized Remediation Sequence'));
  check('Plan includes Patch 82X section', mdContent.includes('Patch 82X'));
  check('Plan includes Patch 82Y section', mdContent.includes('Patch 82Y'));
  check('Plan includes Patch 82Z section', mdContent.includes('Patch 82Z'));
  check('Plan includes Patch 83A section', mdContent.includes('Patch 83A'));
  check('Plan includes Stop/go gates section', mdContent.includes('Stop/go gates') || mdContent.includes('Stop/Go Gates'));
  check('Plan includes Rollback plan section', mdContent.includes('Rollback plan') || mdContent.includes('Rollback Plan'));
  check('Plan includes Do not do section', mdContent.includes('Do not do') || mdContent.includes('Do Not Do'));
  
  const noForbidden = !mdContent.toLowerCase().includes('system is production ready') &&
                      !mdContent.toLowerCase().includes('go-live complete') &&
                      !mdContent.toLowerCase().includes('production launched') &&
                      !mdContent.toLowerCase().includes('transition_to_live_operations') &&
                      !mdContent.toLowerCase().includes('platform is secure');
  check('Forbidden claims are absent', noForbidden);
} else {
  check('MD sections exist', false, 'MD file missing');
  check('Forbidden claims are absent', false, 'MD file missing');
}

if (fs.existsSync(jsonPath)) {
  const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const hasFields = jsonContent.patches && jsonContent.patches.every(p => 
    p.patchId && p.riskLevel && p.affectedAreas && p.proofRequirements && p.rollbackPlan
  );
  check('The JSON includes patch ids, risk levels, affected areas, proof requirements, and rollback notes', hasFields);
} else {
  check('JSON structure check', false, 'JSON file missing');
}

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
