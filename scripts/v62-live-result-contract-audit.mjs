import fs from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const releaseDir = path.resolve('release', 'v62');
fs.mkdirSync(releaseDir, { recursive: true });

const requiredFile = path.resolve('src', 'lib', 'liveResult.ts');
const findings = [];
if (!fs.existsSync(requiredFile)) {
  findings.push({ severity: 'critical', code: 'MISSING_LIVE_RESULT_CONTRACT', file: 'src/lib/liveResult.ts' });
} else {
  const text = fs.readFileSync(requiredFile, 'utf8');
  for (const required of ['LiveResult', 'liveResult', 'emptyResult', 'unauthorizedResult', 'configurationErrorResult', 'queryErrorResult']) {
    if (!text.includes(required)) findings.push({ severity: 'critical', code: 'MISSING_LIVE_RESULT_EXPORT', file: 'src/lib/liveResult.ts', required });
  }
  for (const status of ['live', 'empty', 'unauthorized', 'configuration_error', 'query_error']) {
    if (!text.includes(status)) findings.push({ severity: 'critical', code: 'MISSING_LIVE_STATUS', file: 'src/lib/liveResult.ts', status });
  }
}

const summary = {
  generated_at: new Date().toISOString(),
  live_result_contract_present: fs.existsSync(requiredFile),
  total_findings: findings.length,
  production_blocking_findings: findings.filter((f) => f.severity === 'critical').length,
  policy: 'Live data reads should move toward a typed result contract: live | empty | unauthorized | configuration_error | query_error.'
};
fs.writeFileSync(path.join(releaseDir, 'v62-live-result-contract-audit.json'), JSON.stringify({ ...summary, findings }, null, 2) + '\n');
console.log('v6.2 live result contract audit complete.');
console.log(JSON.stringify(summary, null, 2));
if (strict && findings.some((f) => f.severity === 'critical')) process.exit(2);
