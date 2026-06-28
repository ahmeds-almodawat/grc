import fs from 'node:fs';

const read = (file) => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const write = (file, content) => fs.writeFileSync(file, content);

function updatePackage() {
  const path = 'package.json';
  if (!fs.existsSync(path)) {
    console.warn('package.json not found; skipped v19 package script install.');
    return;
  }
  const pkg = JSON.parse(read(path));
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['v190:executive-reporting-audit'] = 'node scripts/v190-executive-reporting-static-audit.mjs';
  pkg.scripts['v190:executive-reporting-report'] = 'node scripts/v190-executive-reporting-report.mjs';
  pkg.scripts['v190:final-proof'] = 'node scripts/v190-final-proof.mjs';
  pkg.scripts['pilot:v190-executive-reporting'] = 'npm run v190:executive-reporting-audit && npm run v190:executive-reporting-report && npm run v190:final-proof';
  write(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

function updateCi() {
  const path = '.github/workflows/ci.yml';
  if (!fs.existsSync(path)) return;
  let yml = read(path);
  if (yml.includes('pilot:v190-executive-reporting')) return;

  const step = [
    '          - name: v19 executive reporting proof',
    '            run: npm run pilot:v190-executive-reporting',
  ].join('\n');

  if (yml.includes('pilot:v180-traceability')) {
    yml = yml.replace(
      /(\s+- name: v18[^\n]*\n\s+run: npm run pilot:v180-traceability)/,
      `$1\n${step}`,
    );
  } else if (yml.includes('pilot:uat-readiness')) {
    yml = yml.replace(
      /(\s+- name: UAT readiness static proof\n\s+run: npm run pilot:uat-readiness)/,
      `${step}\n$1`,
    );
  } else {
    yml = `${yml.trimEnd()}\n${step}\n`;
  }

  write(path, yml);
}

function addImport(source, importLine) {
  if (source.includes(importLine)) return source;
  const importMatches = [...source.matchAll(/^import .*;$/gm)];
  if (!importMatches.length) return `${importLine}\n${source}`;
  const last = importMatches[importMatches.length - 1];
  const index = last.index + last[0].length;
  return `${source.slice(0, index)}\n${importLine}${source.slice(index)}`;
}

function injectBefore(source, needle, insertion) {
  if (source.includes(insertion.trim())) return source;
  const idx = source.indexOf(needle);
  if (idx === -1) return source;
  return `${source.slice(0, idx)}${insertion}\n${source.slice(idx)}`;
}

function injectAfter(source, needle, insertion) {
  if (source.includes(insertion.trim())) return source;
  const idx = source.indexOf(needle);
  if (idx === -1) return source;
  const end = idx + needle.length;
  return `${source.slice(0, end)}\n${insertion}${source.slice(end)}`;
}

function updateExecutiveCommandCenter() {
  const path = 'src/pages/ExecutiveCommandCenter.tsx';
  if (!fs.existsSync(path)) return;
  let src = read(path);
  src = addImport(src, "import { ExecutiveGrcScorecard } from '../components/v190/ExecutiveGrcScorecard';");
  src = addImport(src, "import { AutomationAlertPanel } from '../components/v190/AutomationAlertPanel';");
  src = injectBefore(
    src,
    '      <DataState',
    '      <ExecutiveGrcScorecard context="command-center" />\n      <AutomationAlertPanel context="command-center" />\n\n',
  );
  write(path, src);
}

function updateBoardPackCenter() {
  const path = 'src/pages/BoardPackCenter.tsx';
  if (!fs.existsSync(path)) return;
  let src = read(path);
  src = addImport(src, "import { BoardReportingPackPanel } from '../components/v190/BoardReportingPackPanel';");
  src = injectBefore(
    src,
    '      <DataState',
    '      <BoardReportingPackPanel />\n\n',
  );
  write(path, src);
}

function updateCommitteeAutomationCenter() {
  const path = 'src/pages/CommitteeActionAutomationCenter.tsx';
  if (!fs.existsSync(path)) return;
  let src = read(path);
  src = addImport(src, "import { AutomationAlertPanel } from '../components/v190/AutomationAlertPanel';");
  src = injectAfter(
    src,
    '      </div>',
    '\n      <AutomationAlertPanel context="committee" />',
  );
  write(path, src);
}

updatePackage();
updateCi();
updateExecutiveCommandCenter();
updateBoardPackCenter();
updateCommitteeAutomationCenter();

console.log('v19 package scripts installed, CI updated, and executive reporting panels injected where matching pages exist.');
