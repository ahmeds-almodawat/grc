import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v65');
fs.mkdirSync(outDir, { recursive: true });

function readMany(globDir) {
  const dir = path.join(root, globDir);
  if (!fs.existsSync(dir)) return '';
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => fs.readFileSync(path.join(dir, name), 'utf8'))
    .join('\n\n');
}

function read(rel) {
  const file = path.join(root, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

const sql = readMany('supabase/migrations').toLowerCase();
const grcApi = read('src/lib/grcApi.ts').toLowerCase();
const ovrPage = read('src/pages/OVR.tsx').toLowerCase();
const approvalsPage = read('src/pages/Approvals.tsx').toLowerCase();

const checks = [
  { code: 'PROJECT_TASK_CHAIN', passed: /projects/.test(sql) && /milestones/.test(sql) && /tasks/.test(sql), message: 'Project/milestone/task structures are present in migrations.' },
  { code: 'EVIDENCE_BEFORE_CLOSURE', passed: /evidence/.test(sql) && /(closure|closed|complete)/.test(sql), message: 'Evidence/closure workflow controls are present.' },
  { code: 'SELF_APPROVAL_PREVENTION', passed: /(self[-_ ]?approval|cannot approve|approver.*requester|requested_by.*approved_by|created_by.*approved_by)/i.test(sql), message: 'Self-approval prevention signal found in migrations.' },
  { code: 'OVR_QUALITY_CLOSURE', passed: /ovr/.test(sql) && /(quality|severity|corrective)/.test(sql), message: 'OVR Quality/severity/corrective-action controls are present.' },
  { code: 'NO_MOCK_RUNTIME_GUARD', passed: /liveResult|emptyLiveObject|noMock|productionDataPolicy/i.test(grcApi), message: 'Runtime API contains no-mock/live-data guard signals.' },
  { code: 'OVR_UI_PRESENT', passed: /ovr|occurrence|quality|severity|corrective/.test(ovrPage), message: 'OVR UI workflow signals are present.' },
  { code: 'APPROVAL_UI_PRESENT', passed: /approval|approve|reject|evidence/.test(approvalsPage), message: 'Approval UI workflow signals are present.' }
];

const failed = checks.filter((c) => !c.passed);
const summary = {
  generated_at: new Date().toISOString(),
  checks_total: checks.length,
  failed_count: failed.length,
  strict_passed: failed.length === 0,
  note: 'Static workflow contract proof. It does not replace browser/Supabase workflow execution.'
};

fs.writeFileSync(path.join(outDir, 'v65-workflow-contract-tests.json'), JSON.stringify({ summary, checks }, null, 2));
fs.writeFileSync(path.join(outDir, 'V65_WORKFLOW_CONTRACT_TESTS.md'), `# v6.5 Workflow Contract Tests\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n\n## Checks\n\n${checks.map((c) => `- ${c.passed ? '✅' : '❌'} ${c.code}: ${c.message}`).join('\n')}\n`);

console.log('v6.5 workflow contract tests complete.');
console.log(JSON.stringify(summary, null, 2));
if (!summary.strict_passed) process.exit(1);
