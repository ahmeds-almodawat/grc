import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function write(file, content) {
  fs.writeFileSync(file, content);
}

function addPackageScripts() {
  const packagePath = path.join(root, 'package.json');
  const pkg = JSON.parse(read(packagePath));
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['v180:traceability-audit'] = 'node scripts/v180-grc-traceability-static-audit.mjs';
  pkg.scripts['v180:traceability-report'] = 'node scripts/v180-grc-traceability-report.mjs';
  pkg.scripts['v180:final-proof'] = 'node scripts/v180-final-proof.mjs';
  pkg.scripts['pilot:v180-traceability'] = 'npm run v180:traceability-audit && npm run v180:traceability-report && npm run v180:final-proof';
  write(packagePath, JSON.stringify(pkg, null, 2) + '\n');
}

function updateWorkflow() {
  const workflowPath = path.join(root, '.github', 'workflows', 'ci.yml');
  if (!fs.existsSync(workflowPath)) return;
  let content = read(workflowPath);
  if (content.includes('pilot:v180-traceability')) return;

  const step = `\n          - name: v18 traceability proof\n            run: npm run pilot:v180-traceability`;

  const anchors = [
    '          - name: v17 enterprise risk proof\n            run: npm run pilot:v170-enterprise-risk',
    '          - name: v16 compliance management proof\n            run: npm run pilot:v160-compliance-management',
    '          - name: v15 audit program proof\n            run: npm run pilot:v150-audit-program',
    '          - name: v14 professional GRC proof\n            run: npm run pilot:v140-professional-grc',
    '          - name: UAT readiness static proof\n            run: npm run pilot:uat-readiness',
  ];

  for (const anchor of anchors) {
    if (content.includes(anchor)) {
      content = content.replace(anchor, `${anchor}${step}`);
      write(workflowPath, content);
      return;
    }
  }

  content += step + '\n';
  write(workflowPath, content);
}

function ensureImport(content, importLine) {
  if (content.includes(importLine)) return content;
  const lines = content.split('\n');
  let lastImport = -1;
  lines.forEach((line, index) => {
    if (line.startsWith('import ')) lastImport = index;
  });
  lines.splice(lastImport + 1, 0, importLine);
  return lines.join('\n');
}

function insertAfterModuleHeader(content, block) {
  if (content.includes(block.trim().split('\n')[0].trim())) return content;
  const marker = '      />\n';
  const index = content.indexOf(marker);
  if (index === -1) return content;
  return content.slice(0, index + marker.length) + '\n' + block + '\n' + content.slice(index + marker.length);
}

function insertAfterDataState(content, block) {
  if (content.includes(block.trim().split('\n')[0].trim())) return content;
  const marker = '      </DataState>\n';
  const index = content.indexOf(marker);
  if (index === -1) return content;
  return content.slice(0, index + marker.length) + '\n' + block + '\n' + content.slice(index + marker.length);
}

function patchGovernance() {
  const file = path.join(root, 'src', 'pages', 'Governance.tsx');
  if (!fs.existsSync(file)) return;
  let content = read(file);
  content = ensureImport(content, "import { AssuranceMapPanel } from '../components/v180/AssuranceMapPanel';");
  content = ensureImport(content, "import { GrcTraceabilityMap } from '../components/v180/GrcTraceabilityMap';");
  content = ensureImport(content, "import { TraceabilityGapPanel } from '../components/v180/TraceabilityGapPanel';");
  content = insertAfterModuleHeader(content, `      <GrcTraceabilityMap context="governance" />\n      <AssuranceMapPanel />\n      <TraceabilityGapPanel />`);
  write(file, content);
}

function patchEvidence() {
  const file = path.join(root, 'src', 'pages', 'Evidence.tsx');
  if (!fs.existsSync(file)) return;
  let content = read(file);
  content = ensureImport(content, "import { GrcTraceabilityMap } from '../components/v180/GrcTraceabilityMap';");
  content = insertAfterModuleHeader(content, `      <GrcTraceabilityMap context="evidence" />`);
  write(file, content);
}

function patchExecutive() {
  const file = path.join(root, 'src', 'pages', 'ExecutiveCommandCenter.tsx');
  if (!fs.existsSync(file)) return;
  let content = read(file);
  content = ensureImport(content, "import { AssuranceMapPanel } from '../components/v180/AssuranceMapPanel';");
  content = ensureImport(content, "import { TraceabilityGapPanel } from '../components/v180/TraceabilityGapPanel';");
  content = insertAfterDataState(content, `      <AssuranceMapPanel />\n      <TraceabilityGapPanel />`);
  write(file, content);
}

addPackageScripts();
updateWorkflow();
patchGovernance();
patchEvidence();
patchExecutive();

console.log('v18 package scripts installed, CI updated, and traceability panels injected where matching pages exist.');
