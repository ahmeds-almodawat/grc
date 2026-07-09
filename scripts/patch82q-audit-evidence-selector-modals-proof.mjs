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

const audit = fs.readFileSync(path.join(rootDir, 'src/pages/Audit.tsx'), 'utf8');
check('Audit.tsx does not contain visible labels requiring raw ID typing for Owner', !audit.match(/<label>Owner Profile ID \(Optional\)<\/label>\s*<input/));
check('Audit.tsx does not contain visible labels requiring raw ID typing for Extension', !audit.match(/<label>Extension ID \*<\/label>\s*<input/));
check('Audit.tsx does not contain visible labels requiring raw ID typing for Risk', !audit.match(/<label>Related Risk ID \*<\/label>\s*<input/));
check('Audit.tsx does not contain visible labels requiring raw ID typing for Compliance', !audit.match(/<label>Related Compliance Item ID \*<\/label>\s*<input/));
check('Audit.tsx does not contain visible labels requiring raw ID typing for Original Finding', !audit.match(/<label>Original Finding ID \(Optional\)<\/label>\s*<input/));

check('Audit.tsx contains selector controls for related risk/compliance/owner or clear no-record messages', audit.includes('<select value={payload.relatedRiskId') && audit.includes('<select value={payload.relatedComplianceId') && audit.includes('<select value={payload.correctiveActionOwnerId'));
check('Audit.tsx still contains Audit Findings Register', audit.includes('Audit findings register'));

const evidence = fs.readFileSync(path.join(rootDir, 'src/pages/Evidence.tsx'), 'utf8');
check('Evidence.tsx does not contain visible labels requiring raw ID typing for evidence', !evidence.match(/<label>Replacement Evidence File ID \*<\/label>\s*<input/));
check('Evidence.tsx does not contain visible labels requiring raw ID typing for waiver', !evidence.match(/<label>Waiver ID \*<\/label>\s*<input/));

check('Evidence.tsx contains selector controls/classification options or clear no-record messages', evidence.includes('<select autoFocus value={payload.newEvidenceId') && evidence.includes('No selectable records are available'));
check('Evidence.tsx still contains Evidence Library', evidence.includes('Evidence Library'));

check('Audit.tsx and Evidence.tsx still do not contain window.prompt or window.confirm', !audit.includes('window.prompt') && !audit.includes('window.confirm') && !evidence.includes('window.prompt') && !evidence.includes('window.confirm'));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed.');
}
