import fs from 'node:fs';

const read = (file) => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const write = (file, content) => fs.writeFileSync(file, content);

function updatePackage() {
  const path = 'package.json';
  if (!fs.existsSync(path)) {
    console.warn('package.json not found; skipped v20 package script install.');
    return;
  }
  const pkg = JSON.parse(read(path));
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['v200:production-readiness-audit'] = 'node scripts/v200-production-readiness-static-audit.mjs';
  pkg.scripts['v200:production-readiness-report'] = 'node scripts/v200-production-readiness-report.mjs';
  pkg.scripts['v200:final-proof'] = 'node scripts/v200-final-proof.mjs';
  pkg.scripts['pilot:v200-production-readiness'] = 'npm run v200:production-readiness-audit && npm run v200:production-readiness-report && npm run v200:final-proof';
  write(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

function updateCi() {
  const path = '.github/workflows/ci.yml';
  if (!fs.existsSync(path)) return;
  let yml = read(path);
  if (yml.includes('pilot:v200-production-readiness')) return;

  const step = [
    '          - name: v20 production readiness proof',
    '            run: npm run pilot:v200-production-readiness',
  ].join('\n');

  const anchors = [
    /(\s+- name: v19[^\n]*\n\s+run: npm run pilot:v190-executive-reporting)/,
    /(\s+- name: v18[^\n]*\n\s+run: npm run pilot:v180-traceability)/,
    /(\s+- name: UAT readiness static proof\n\s+run: npm run pilot:uat-readiness)/,
  ];

  let updated = false;
  for (const anchor of anchors) {
    if (anchor.test(yml)) {
      yml = yml.replace(anchor, `$1\n${step}`);
      updated = true;
      break;
    }
  }
  if (!updated) yml = `${yml.trimEnd()}\n${step}\n`;
  write(path, yml);
}

function addImport(source, importLine) {
  if (source.includes(importLine)) return source;
  const importRegex = /^import[\s\S]*?;$/gm;
  let lastEnd = 0;
  let match;
  while ((match = importRegex.exec(source)) !== null) {
    lastEnd = match.index + match[0].length;
  }
  if (!lastEnd) return `${importLine}\n${source}`;
  return `${source.slice(0, lastEnd)}\n${importLine}${source.slice(lastEnd)}`;
}

function injectAfterSectionOpen(source, componentMarkup) {
  if (source.includes(componentMarkup.trim())) return source;
  const sectionOpen = /(<section\b[^>]*>)/;
  if (!sectionOpen.test(source)) return source;
  return source.replace(sectionOpen, `$1\n      ${componentMarkup}`);
}

function updatePage(path, imports, componentMarkup) {
  if (!fs.existsSync(path)) return;
  let src = read(path);
  for (const importLine of imports) src = addImport(src, importLine);
  src = injectAfterSectionOpen(src, componentMarkup);
  write(path, src);
}

updatePackage();
updateCi();

updatePage(
  'src/pages/ControlledUatWorkbench.tsx',
  ["import { UatClosureDashboard } from '../components/v200/UatClosureDashboard';"],
  '<UatClosureDashboard />',
);

updatePage(
  'src/pages/ProductionReleaseCenter.tsx',
  ["import { ProductionReadinessGatePanel } from '../components/v200/ProductionReadinessGatePanel';"],
  '<ProductionReadinessGatePanel context="release" />',
);

updatePage(
  'src/pages/ProductionProofCenter.tsx',
  [
    "import { ProductionReadinessGatePanel } from '../components/v200/ProductionReadinessGatePanel';",
    "import { SecurityBackupHardeningPanel } from '../components/v200/SecurityBackupHardeningPanel';",
  ],
  '<ProductionReadinessGatePanel context="proof" />\n      <SecurityBackupHardeningPanel context="proof" />',
);

updatePage(
  'src/pages/SecurityAuditCenter.tsx',
  ["import { SecurityBackupHardeningPanel } from '../components/v200/SecurityBackupHardeningPanel';"],
  '<SecurityBackupHardeningPanel context="security" />',
);

console.log('v20 package scripts installed, CI updated, and production readiness panels injected where matching pages exist.');
