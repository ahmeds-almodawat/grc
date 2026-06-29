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
  for (const importLine of imports) {
    source = ensureImport(source, importLine);
  }
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
  pkg.scripts['v240:assurance-audit'] = 'node scripts/v240-assurance-sod-auditor-static-audit.mjs';
  pkg.scripts['v240:assurance-report'] = 'node scripts/v240-assurance-sod-auditor-report.mjs';
  pkg.scripts['v240:final-proof'] = 'node scripts/v240-final-proof.mjs';
  pkg.scripts['pilot:v240-assurance'] = 'npm run v240:assurance-audit && npm run v240:assurance-report && npm run v240:final-proof';
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return true;
}

function updateCi() {
  const ciPath = path.join(root, '.github/workflows/ci.yml');
  if (!fs.existsSync(ciPath)) return false;
  let ci = fs.readFileSync(ciPath, 'utf8');
  if (ci.includes('pilot:v240-assurance')) return false;
  const step = `\n      - name: v24 assurance and auditor proof\n        run: npm run pilot:v240-assurance\n`;
  const anchors = [
    '        run: npm run pilot:v230-compliance-hardening',
    '        run: npm run pilot:v220-control-testing',
    '        run: npm run pilot:v210-framework-crosswalk',
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

const allImports = [
  "import { AssuranceReadinessPanel } from '../components/v240/AssuranceReadinessPanel';",
  "import { SodImmutableAuditPanel } from '../components/v240/SodImmutableAuditPanel';",
  "import { AuditorEvidencePackPanel } from '../components/v240/AuditorEvidencePackPanel';"
];

const fullBlock = `
      {/* v24.0 assurance, SoD, immutable audit and auditor evidence pack */}
      <AssuranceReadinessPanel />
      <SodImmutableAuditPanel />
      <AuditorEvidencePackPanel />
`;

const injectedGovernance = injectBeforeClosingSection(
  'src/pages/Governance.tsx',
  allImports,
  fullBlock,
  'v24.0 assurance, SoD, immutable audit and auditor evidence pack'
);

const injectedEvidence = injectBeforeClosingSection(
  'src/pages/Evidence.tsx',
  ["import { AuditorEvidencePackPanel } from '../components/v240/AuditorEvidencePackPanel';"],
  `
      {/* v24.0 evidence integrity and auditor pack */}
      <AuditorEvidencePackPanel />
`,
  'v24.0 evidence integrity and auditor pack'
);

const injectedSecurity = injectBeforeClosingSection(
  'src/pages/SecurityAuditCenter.tsx',
  [
    "import { SodImmutableAuditPanel } from '../components/v240/SodImmutableAuditPanel';",
    "import { AuditorEvidencePackPanel } from '../components/v240/AuditorEvidencePackPanel';"
  ],
  `
      {/* v24.0 SoD and immutable audit controls */}
      <SodImmutableAuditPanel />
      <AuditorEvidencePackPanel />
`,
  'v24.0 SoD and immutable audit controls'
);

const injectedProof = injectBeforeClosingSection(
  'src/pages/ProductionProofCenter.tsx',
  ["import { AssuranceReadinessPanel } from '../components/v240/AssuranceReadinessPanel';"],
  `
      {/* v24.0 final assurance readiness */}
      <AssuranceReadinessPanel />
`,
  'v24.0 final assurance readiness'
);

installPackageScripts();
updateCi();

console.log('v24 package scripts installed, CI updated, and assurance/auditor panels injected where matching pages exist.');
console.log({ injectedGovernance, injectedEvidence, injectedSecurity, injectedProof });
