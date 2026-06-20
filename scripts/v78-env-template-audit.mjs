import fs from 'node:fs';
import { lines, mdTable, writeJson, writeMd } from './v78-common.mjs';

const tracked = lines('git ls-files');
const templates = tracked.filter((f) => /^\.env.*\.example$/.test(f) || f.endsWith('/.env.example') || f.endsWith('/.env.production.example'));
const realEnvTracked = tracked.filter((f) => {
  const base = f.split('/').pop();
  if (!base?.startsWith('.env')) return false;
  if (base.endsWith('.example')) return false;
  return true;
});

const localEnvVisible = fs.readdirSync(process.cwd()).filter((f) => f.startsWith('.env') && !f.endsWith('.example'));
const checks = [
  ['env templates present', templates.length > 0 ? 'passed' : 'warning', templates.join(', ') || 'No env templates found'],
  ['real env files not tracked', realEnvTracked.length === 0 ? 'passed' : 'failed', realEnvTracked.join(', ') || 'None'],
  ['local env files visible', localEnvVisible.length === 0 ? 'passed' : 'info', localEnvVisible.join(', ') || 'None'],
];
const failed = checks.filter((c) => c[1] === 'failed').length;
const result = { generated_at: new Date().toISOString(), status: failed ? 'failed' : 'passed', failed, checks };
writeJson('env-template-audit.json', result);
writeMd('env-template-audit.md', `# v7.8 Environment Template Audit\n\nGenerated: ${result.generated_at}\n\nStatus: **${result.status}**\n\n${mdTable(['Check', 'Status', 'Detail'], checks)}\n\n## Safety note\n\nTemplate files such as .env.example are allowed. Real secret-bearing .env files must not be tracked.`);
console.log('v7.8 env template audit generated.');
console.log(JSON.stringify({ status: result.status, failed, report: 'release/v78/env-template-audit.md' }, null, 2));
if (failed > 0) process.exitCode = 1;
