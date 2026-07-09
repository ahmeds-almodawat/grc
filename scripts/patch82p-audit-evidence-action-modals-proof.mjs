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
check('Audit.tsx does not contain window.prompt', !audit.includes('window.prompt'));
check('Audit.tsx does not contain window.confirm', !audit.includes('window.confirm'));
check('Audit.tsx contains an audit action modal/state pattern', audit.includes('const [actionModal, setActionModal]') || audit.includes('AuditActionForm'));
check('Audit.tsx still contains Audit Findings Register', audit.includes('Audit findings register') && audit.includes('EntityTable<AuditFindingRow>'));

const evidence = fs.readFileSync(path.join(rootDir, 'src/pages/Evidence.tsx'), 'utf8');
check('Evidence.tsx does not contain window.prompt', !evidence.includes('window.prompt'));
check('Evidence.tsx does not contain window.confirm', !evidence.includes('window.confirm'));
check('Evidence.tsx contains an evidence action modal/state pattern', evidence.includes('const [actionModal, setActionModal]') || evidence.includes('EvidenceActionForm'));
check('Evidence.tsx still contains Evidence Library', evidence.includes('Evidence Library') && evidence.includes('Evidence review queue'));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed.');
}
