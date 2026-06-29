import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

function write(file, content) {
  fs.writeFileSync(path.join(root, file), content);
}

function findImportInsertionIndex(lines) {
  let insertion = 0;
  let inImport = false;
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!inImport && trimmed.startsWith('import ')) {
      inImport = !trimmed.endsWith(';');
      insertion = i + 1;
      continue;
    }
    if (inImport) {
      insertion = i + 1;
      if (trimmed.endsWith(';')) inImport = false;
      continue;
    }
    if (insertion > 0 && trimmed === '') {
      insertion = i + 1;
      continue;
    }
    if (insertion > 0) break;
  }
  return insertion;
}

function ensureImport(source, importLine) {
  if (source.includes(importLine)) return source;
  const lines = source.split(/\r?\n/);
  const index = findImportInsertionIndex(lines);
  lines.splice(index, 0, importLine);
  return lines.join('\n');
}

function injectBeforeClosingSection(file, imports, block, marker) {
  let source = readIfExists(file);
  if (!source) return false;
  if (source.includes(marker)) return false;
  for (const importLine of imports) source = ensureImport(source, importLine);
  const closeIndex = source.lastIndexOf('</section>');
  if (closeIndex === -1) return false;
  source = `${source.slice(0, closeIndex)}${block}\n${source.slice(closeIndex)}`;
  write(file, source);
  return true;
}

function installPackageScripts() {
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.scripts = pkg.scripts ?? {};
  pkg.scripts['v250:live-operating-audit'] = 'node scripts/v250-live-grc-operating-static-audit.mjs';
  pkg.scripts['v250:live-operating-report'] = 'node scripts/v250-live-grc-operating-report.mjs';
  pkg.scripts['v250:final-proof'] = 'node scripts/v250-final-proof.mjs';
  pkg.scripts['pilot:v250-live-operating'] = 'npm run v250:live-operating-audit && npm run v250:live-operating-report && npm run v250:final-proof';
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return true;
}

function updateCi() {
  const ciPath = path.join(root, '.github/workflows/ci.yml');
  if (!fs.existsSync(ciPath)) return false;
  let ci = fs.readFileSync(ciPath, 'utf8');
  if (ci.includes('pilot:v250-live-operating')) return false;
  const step = `\n      - name: v25 live GRC operating proof\n        run: npm run pilot:v250-live-operating\n`;
  const anchors = [
    '        run: npm run pilot:v240-assurance',
    '        run: npm run pilot:v230-compliance-hardening',
    '        run: npm run pilot:v220-control-testing',
    '        run: npm run proof:all'
  ];
  for (const anchor of anchors) {
    const idx = ci.indexOf(anchor);
    if (idx !== -1) {
      const lineEnd = ci.indexOf('\n', idx);
      ci = `${ci.slice(0, lineEnd + 1)}${step}${ci.slice(lineEnd + 1)}`;
      fs.writeFileSync(ciPath, ci);
      return true;
    }
  }
  ci += step;
  fs.writeFileSync(ciPath, ci);
  return true;
}

const imports = [
  "import { LiveOperatingCyclePanel } from '../components/v250/LiveOperatingCyclePanel';",
  "import { DataBridgeGovernancePanel } from '../components/v250/DataBridgeGovernancePanel';",
  "import { AccessReviewOperatingPanel } from '../components/v250/AccessReviewOperatingPanel';"
];

const fullBlock = `
      {/* v25.0 live GRC operating workspace */}
      <LiveOperatingCyclePanel />
      <DataBridgeGovernancePanel />
      <AccessReviewOperatingPanel />
`;

const releaseBlock = `
      {/* v25.0 live GRC operating workspace */}
      <LiveOperatingCyclePanel />
      <AccessReviewOperatingPanel />
`;

const bridgeBlock = `
      {/* v25.0 live GRC operating workspace */}
      <DataBridgeGovernancePanel />
`;

const injectedGovernance = injectBeforeClosingSection('src/pages/Governance.tsx', imports, fullBlock, 'v25.0 live GRC operating workspace');
const injectedRelease = injectBeforeClosingSection('src/pages/ProductionReleaseCenter.tsx', imports, releaseBlock, 'v25.0 live GRC operating workspace');
const injectedExecutive = injectBeforeClosingSection('src/pages/ExecutiveCommandCenter.tsx', imports, bridgeBlock, 'v25.0 live GRC operating workspace');

installPackageScripts();
updateCi();

console.log('v25 package scripts installed, CI updated, and live operating panels injected where matching pages exist.');
console.log({ injectedGovernance, injectedRelease, injectedExecutive });
