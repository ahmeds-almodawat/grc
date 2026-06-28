import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const marker = 'v22-control-testing-capa';
function read(rel) {
  const p = path.join(root, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}
function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content);
}
function ensurePackageScripts() {
  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.scripts ||= {};
  pkg.scripts['v220:control-testing-audit'] = 'node scripts/v220-control-testing-static-audit.mjs';
  pkg.scripts['v220:control-testing-report'] = 'node scripts/v220-control-testing-report.mjs';
  pkg.scripts['v220:final-proof'] = 'node scripts/v220-final-proof.mjs';
  pkg.scripts['pilot:v220-control-testing'] = 'npm run v220:control-testing-audit && npm run v220:control-testing-report && npm run v220:final-proof';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}
function ensureCiStep() {
  const ciPath = path.join(root, '.github/workflows/ci.yml');
  if (!fs.existsSync(ciPath)) return;
  let ci = fs.readFileSync(ciPath, 'utf8');
  if (ci.includes('pilot:v220-control-testing')) return;
  const step = `\n      - name: v22 control testing proof\n        run: npm run pilot:v220-control-testing`;
  const anchors = [
    '      - name: UAT readiness static proof\n        run: npm run pilot:uat-readiness',
    '      - name: v21 framework crosswalk proof\n        run: npm run pilot:v210-framework-crosswalk',
    '      - name: v20 production readiness proof\n        run: npm run pilot:v200-production-readiness',
  ];
  for (const anchor of anchors) {
    if (ci.includes(anchor)) {
      if (anchor.includes('UAT readiness')) ci = ci.replace(anchor, `${step}\n${anchor}`);
      else ci = ci.replace(anchor, `${anchor}${step}`);
      fs.writeFileSync(ciPath, ci);
      return;
    }
  }
  ci = ci.trimEnd() + step + '\n';
  fs.writeFileSync(ciPath, ci);
}
function ensureImport(content, importLine) {
  if (content.includes(importLine)) return content;
  const importLines = content.split('\n');
  let insertAt = 0;
  for (let i = 0; i < importLines.length; i++) {
    if (importLines[i].startsWith('import ')) insertAt = i + 1;
  }
  importLines.splice(insertAt, 0, importLine);
  return importLines.join('\n');
}
function insertAfterModuleHeader(content, jsxBlock) {
  if (content.includes(marker) || content.includes(jsxBlock.trim().split('\n')[0].trim())) return content;
  const lines = content.split('\n');
  const start = lines.findIndex(line => line.includes('<ModuleHeader'));
  if (start === -1) return content;
  for (let i = start + 1; i < Math.min(lines.length, start + 80); i++) {
    if (/^\s{6,8}\/>\s*$/.test(lines[i])) {
      lines.splice(i + 1, 0, '', ...jsxBlock.split('\n'));
      return lines.join('\n');
    }
  }
  return content;
}
function inject(rel, imports, block) {
  const filePath = path.join(root, rel);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  for (const importLine of imports) content = ensureImport(content, importLine);
  content = insertAfterModuleHeader(content, block);
  fs.writeFileSync(filePath, content);
}

ensurePackageScripts();
ensureCiStep();

inject('src/pages/Risks.tsx', [
  "import { ControlTestingWorkflowPanel } from '../components/v220/ControlTestingWorkflowPanel';",
  "import { ControlAssuranceReadinessPanel } from '../components/v220/ControlAssuranceReadinessPanel';",
], `      {/* ${marker}: risk control testing linkage */}
      <ControlTestingWorkflowPanel />
      <ControlAssuranceReadinessPanel />`);

inject('src/pages/Audit.tsx', [
  "import { CapaExecutionPanel } from '../components/v220/CapaExecutionPanel';",
  "import { ControlAssuranceReadinessPanel } from '../components/v220/ControlAssuranceReadinessPanel';",
], `      {/* ${marker}: audit CAPA execution linkage */}
      <CapaExecutionPanel />
      <ControlAssuranceReadinessPanel />`);

inject('src/pages/Governance.tsx', [
  "import { ControlAssuranceReadinessPanel } from '../components/v220/ControlAssuranceReadinessPanel';",
], `      {/* ${marker}: governance assurance readiness */}
      <ControlAssuranceReadinessPanel />`);

console.log('v22 package scripts installed, CI updated, and control testing panels injected where matching pages exist.');
