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
const evidence = fs.readFileSync(path.join(rootDir, 'src/pages/Evidence.tsx'), 'utf8');

check('Audit.tsx contains selected finding context in the action modal', audit.includes('<small>Finding: {findingTitle}</small>'));
check('Evidence.tsx contains selected evidence context in the action modal', evidence.includes('<small>Evidence: {evidenceTitle}</small>'));
check('Audit.tsx has disabled submit or validation for missing required fields', audit.includes('!isValid'));
check('Evidence.tsx has disabled submit or validation for missing required fields', evidence.includes('!isValid'));
check('Audit.tsx has warning copy for destructive/negative actions', audit.includes('This is a destructive or negative action. Please provide a clear reason.'));
check('Evidence.tsx has warning copy for reject/request-more-evidence actions', evidence.includes('This is a destructive or negative action. Please provide a clear reason.'));
check('Audit.tsx contains "No selectable extension request is available in your current scope."', audit.includes('No selectable extension request is available in your current scope.'));
check('Evidence.tsx contains "No selectable records are available in your current scope."', evidence.includes('No selectable records are available in your current scope.'));
check('Audit.tsx and Evidence.tsx still do not contain window.prompt or window.confirm', !audit.includes('window.prompt') && !audit.includes('window.confirm') && !evidence.includes('window.prompt') && !evidence.includes('window.confirm'));
check('Audit.tsx still contains Audit Findings Register', audit.includes('Audit findings register'));
check('Evidence.tsx still contains Evidence Library', evidence.includes('Evidence Library'));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed.');
}
