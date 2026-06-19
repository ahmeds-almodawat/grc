import fs from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const root = process.cwd();
const releaseDir = path.resolve('release', 'v62');
fs.mkdirSync(releaseDir, { recursive: true });

const scanRoots = ['src/lib', 'src/pages', 'src/components'].map((p) => path.resolve(p)).filter(fs.existsSync);
const allowFilePatterns = [
  /src[\\/]lib[\\/]demoMode\.ts$/,
  /src[\\/]lib[\\/]liveResult\.ts$/,
  /src[\\/]lib[\\/]liveData\.ts$/,
  /src[\\/]lib[\\/]productionDataPolicy\.ts$/,
  /NoMockAutoTestCenter\.tsx$/,
  /ProductionDataControlCenter\.tsx$/
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'release', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = scanRoots.flatMap((dir) => walk(dir));
const findings = [];

const runtimeDemoImportRegex = /from\s+['\"](?:\.\.\/|\.\/|@\/)?(?:src\/)?demo(?:\/|['\"])/;
const hardcodedRuntimeRecordsRegex = /(const|let|var)\s+[A-Za-z0-9_$]*(mock|demo|sample|fake|dummy|fallback)[A-Za-z0-9_$]*\s*[:=]/i;
const runtimeFallbackReturnLineRegex = /return\s+[A-Za-z0-9_$]*(mock|demo|sample|fake|dummy|fallback)[A-Za-z0-9_$]*/i;
const directLiteralFallbackRegex = /return\s*(\[\s*\{\s*(id|organization|title|name)|\{\s*(id|organization|title|name))/i;
const liveErrorSwallowRegex = /catch\s*\([^)]*\)\s*\{[\s\S]{0,250}return\s+(\[\]|\{\}|null|undefined)/i;
const hardcodedDemoOrgRegex = /['\"]demo(?:-org)?['\"]/i;

for (const file of files) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const text = fs.readFileSync(file, 'utf8');
  const allowed = allowFilePatterns.some((pattern) => pattern.test(rel));
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (runtimeDemoImportRegex.test(line) && !rel.includes('/demo/') && !allowed) {
      findings.push({ severity: 'critical', code: 'DEMO_IMPORT_OUTSIDE_BOUNDARY', file: rel, line: index + 1, text: trimmed });
    }
    if (!allowed && hardcodedRuntimeRecordsRegex.test(line)) {
      findings.push({ severity: 'high', code: 'DEMO_OR_FALLBACK_SYMBOL', file: rel, line: index + 1, text: trimmed });
    }
    if (!allowed && runtimeFallbackReturnLineRegex.test(line)) {
      findings.push({ severity: 'high', code: 'RUNTIME_FALLBACK_RETURN', file: rel, line: index + 1, text: trimmed });
    }
    if (!allowed && directLiteralFallbackRegex.test(line)) {
      findings.push({ severity: 'high', code: 'DIRECT_LITERAL_RECORD_RETURN', file: rel, line: index + 1, text: trimmed });
    }
    if (!allowed && hardcodedDemoOrgRegex.test(line)) {
      findings.push({ severity: 'medium', code: 'HARDCODED_DEMO_ORG_SIGNAL', file: rel, line: index + 1, text: trimmed });
    }
  });

  if (!allowed && liveErrorSwallowRegex.test(text)) {
    findings.push({ severity: 'medium', code: 'QUERY_ERROR_SWALLOWED_AS_EMPTY', file: rel, line: null, text: 'Catch block may convert query errors into empty/null values.' });
  }
}

const blocking = findings.filter((f) => ['critical', 'high'].includes(f.severity));
const summary = {
  generated_at: new Date().toISOString(),
  scanned_files: files.length,
  total_findings: findings.length,
  production_blocking_findings: blocking.length,
  critical: findings.filter((f) => f.severity === 'critical').length,
  high: findings.filter((f) => f.severity === 'high').length,
  medium: findings.filter((f) => f.severity === 'medium').length,
  files_with_findings: new Set(findings.map((f) => f.file)).size,
  policy: 'No direct demo imports, no hardcoded runtime demo/fallback records, no runtime fallback returns. Empty/error states must be explicit.'
};

fs.writeFileSync(path.join(releaseDir, 'v62-real-data-static-audit.json'), JSON.stringify({ ...summary, findings }, null, 2) + '\n');
console.log('v6.2 real data static audit complete.');
console.log(JSON.stringify(summary, null, 2));

if (strict && blocking.length > 0) {
  console.error(`v6.2 strict static audit failed: ${blocking.length} blocking findings remain.`);
  process.exit(2);
}
