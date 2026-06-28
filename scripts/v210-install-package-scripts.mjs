import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function ensurePackageScripts() {
  const packagePath = path.join(root, 'package.json');
  const pkg = readJson(packagePath);
  pkg.scripts = pkg.scripts || {};
  const scripts = {
    'v210:framework-crosswalk-audit': 'node scripts/v210-framework-crosswalk-static-audit.mjs',
    'v210:framework-crosswalk-report': 'node scripts/v210-framework-crosswalk-report.mjs',
    'v210:final-proof': 'node scripts/v210-final-proof.mjs',
    'pilot:v210-framework-crosswalk': 'npm run v210:framework-crosswalk-audit && npm run v210:framework-crosswalk-report && npm run v210:final-proof',
  };
  for (const [name, command] of Object.entries(scripts)) {
    pkg.scripts[name] = command;
  }
  writeJson(packagePath, pkg);
}

function ensureCiStep() {
  const ciPath = path.join(root, '.github', 'workflows', 'ci.yml');
  if (!fs.existsSync(ciPath)) return;
  let content = fs.readFileSync(ciPath, 'utf8');
  if (content.includes('pilot:v210-framework-crosswalk')) return;

  const lines = content.split(/\r?\n/);
  let insertAt = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].includes('run: npm run pilot:')) {
      insertAt = index + 1;
      break;
    }
  }

  const step = [
    '          - name: v21 framework crosswalk proof',
    '            run: npm run pilot:v210-framework-crosswalk',
  ];

  if (insertAt === -1) {
    content += `\n${step.join('\n')}\n`;
  } else {
    lines.splice(insertAt, 0, ...step);
    content = lines.join('\n');
  }
  fs.writeFileSync(ciPath, content, 'utf8');
}

function findLastImportIndex(lines) {
  let inImport = false;
  let lastImportIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!inImport && trimmed.startsWith('import ')) {
      inImport = !trimmed.endsWith(';');
      lastImportIndex = i;
      if (!inImport) continue;
    } else if (inImport) {
      if (trimmed.endsWith(';')) {
        inImport = false;
        lastImportIndex = i;
      }
      continue;
    } else if (trimmed && !trimmed.startsWith('//')) {
      if (lastImportIndex >= 0) break;
    }
  }
  return lastImportIndex;
}

function ensureImport(content, importLine) {
  if (content.includes(importLine)) return content;
  const lines = content.split(/\r?\n/);
  const insertAt = findLastImportIndex(lines);
  if (insertAt === -1) return `${importLine}\n${content}`;
  lines.splice(insertAt + 1, 0, importLine);
  return lines.join('\n');
}

function injectPanel(file, context, anchors) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) return { file, status: 'missing' };

  let content = fs.readFileSync(fullPath, 'utf8');
  const importLine = "import { FrameworkCrosswalkBackbonePanel } from '../components/v210/FrameworkCrosswalkBackbonePanel';";
  content = ensureImport(content, importLine);

  const marker = `<FrameworkCrosswalkBackbonePanel context="${context}" />`;
  if (content.includes(marker)) {
    fs.writeFileSync(fullPath, content, 'utf8');
    return { file, status: 'already_present' };
  }

  const panel = `\n      ${marker}\n`;
  for (const anchor of anchors) {
    const idx = content.indexOf(anchor);
    if (idx !== -1) {
      content = `${content.slice(0, idx)}${panel}${content.slice(idx)}`;
      fs.writeFileSync(fullPath, content, 'utf8');
      return { file, status: 'injected' };
    }
  }

  const sectionClose = content.lastIndexOf('\n    </section>');
  if (sectionClose !== -1) {
    content = `${content.slice(0, sectionClose)}${panel}${content.slice(sectionClose)}`;
    fs.writeFileSync(fullPath, content, 'utf8');
    return { file, status: 'injected_before_section_close' };
  }

  fs.writeFileSync(fullPath, content, 'utf8');
  return { file, status: 'import_only_no_anchor' };
}

ensurePackageScripts();
ensureCiStep();

const injections = [
  injectPanel('src/pages/Governance.tsx', 'governance', [
    '\n\n      <div className="module-grid">',
    '\n\n      <div className="panel">',
    '\n\n      <DataState',
  ]),
  injectPanel('src/pages/Risks.tsx', 'risk', [
    '\n\n      {controlMessage ?',
    '\n\n      <div className="module-grid">',
    '\n\n      <div className="panel">',
  ]),
  injectPanel('src/pages/Compliance.tsx', 'compliance', [
    '\n\n      <div className="module-grid">',
    '\n\n      <div className="panel">',
    '\n\n      <DataState',
  ]),
  injectPanel('src/pages/Audit.tsx', 'audit', [
    '\n\n      <div className="panel two-column">',
    '\n\n      <div className="panel">',
    '\n\n      <DataState',
  ]),
  injectPanel('src/pages/Evidence.tsx', 'evidence', [
    '\n\n      {error ?',
    '\n\n      {testFillMessage ?',
    '\n\n      <div className="panel two-column">',
    '\n\n      <DataState',
  ]),
  injectPanel('src/pages/ExecutiveCommandCenter.tsx', 'executive', [
    '\n\n      <DataState',
    '\n\n      <div className="two-column align-start command-layout">',
  ]),
];

fs.mkdirSync(path.join(root, 'release', 'v210'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'release', 'v210', 'v210-install-summary.json'),
  `${JSON.stringify({ status: 'applied', generated_at: new Date().toISOString(), injections }, null, 2)}\n`,
  'utf8',
);

console.log('v21 package scripts installed, CI updated, and framework crosswalk panels injected where matching pages exist.');
console.table(injections);
