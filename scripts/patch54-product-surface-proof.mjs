import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reportPath = path.join(root, 'release', 'patch54', 'patch54-surface-proof.json');

const operationalFiles = [
  'src/pages/ProductionReadinessCenter.tsx',
  'src/pages/BilingualDictionaryCenter.tsx',
  'src/pages/BackupSchedulerCenter.tsx',
  'src/components/v150/AuditEngagementChecklist.tsx',
  'src/App.tsx',
  'src/lib/productionReadinessApi.ts',
];

const bannedVisibleTerms = [
  'scaffold',
  'scaffolding',
  'mock',
  'demo',
  'proof',
  'patch',
  'migration',
  'schema',
  'rpc',
  'edge bridge',
  'unknown_requires_review',
];

const allowedTechnicalStrings = [
  /^src\//,
  /^\.\.?\//,
  /^v_patch/i,
  /^patch\d+/i,
  /^get[A-Z]/,
  /^create_/,
  /^update_/,
  /^record_/,
  /^v\d+/i,
  /^[a-z][a-z0-9]*(?:\.[a-zA-Z0-9]+)+$/,
  /^[a-z0-9_]+$/i,
  /^C:/i,
];

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function extractQuotedStrings(source) {
  const strings = [];
  const pattern = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let match;
  while ((match = pattern.exec(source))) {
    strings.push(match[2]);
  }
  return strings;
}

function isVisibleCandidate(value) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.includes('${')) return false;
  if (allowedTechnicalStrings.some(pattern => pattern.test(trimmed))) return false;
  if (/^[a-z]+(?:[A-Z][a-z0-9]*)+$/.test(trimmed)) return false;
  return /[A-Za-z\u0600-\u06FF]/.test(trimmed);
}

function visibleTermFindings() {
  const findings = [];
  for (const relPath of operationalFiles) {
    const source = read(relPath);
    for (const value of extractQuotedStrings(source).filter(isVisibleCandidate)) {
      const normalized = value.toLowerCase();
      const term = bannedVisibleTerms.find(item => normalized.includes(item));
      if (term) findings.push({ file: relPath, term, value });
    }
  }
  return findings;
}

function conflictMarkerFindings() {
  const findings = [];
  for (const relPath of operationalFiles) {
    const source = read(relPath);
    if (/^(<<<<<<<|=======|>>>>>>>)$/m.test(source)) findings.push(relPath);
  }
  return findings;
}

function auditChecklistExposure() {
  const references = [];
  const srcDir = path.join(root, 'src');
  const stack = [srcDir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const relPath = path.relative(root, fullPath).replaceAll(path.sep, '/');
      const source = fs.readFileSync(fullPath, 'utf8');
      if (relPath !== 'src/components/v150/AuditEngagementChecklist.tsx' && source.includes('AuditEngagementChecklist')) {
        references.push(relPath);
      }
    }
  }
  return references;
}

function fakeRecordFindings() {
  const findings = [];
  for (const relPath of operationalFiles) {
    const source = read(relPath).toLowerCase();
    if (source.includes('insert into') || source.includes('seed demo') || source.includes('fake record')) findings.push(relPath);
  }
  return findings;
}

const checks = [
  { name: 'current platform status document exists', passed: fs.existsSync(path.join(root, 'release/current-platform-status.md')) },
  { name: 'release patch54 directory exists', passed: fs.existsSync(path.join(root, 'release/patch54')) },
  { name: 'no visible banned technical wording', passed: visibleTermFindings().length === 0, findings: visibleTermFindings() },
  { name: 'audit checklist not exposed in normal source navigation', passed: auditChecklistExposure().length === 0, findings: auditChecklistExposure() },
  { name: 'no conflict markers in patched surfaces', passed: conflictMarkerFindings().length === 0, findings: conflictMarkerFindings() },
  { name: 'no fake/demo records introduced in patched surfaces', passed: fakeRecordFindings().length === 0, findings: fakeRecordFindings() },
];

const report = {
  generated_at: new Date().toISOString(),
  strict_passed: checks.every(check => check.passed),
  check_count: checks.length,
  failed_count: checks.filter(check => !check.passed).length,
  failed: checks.filter(check => !check.passed),
  checks,
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.strict_passed) process.exit(1);
