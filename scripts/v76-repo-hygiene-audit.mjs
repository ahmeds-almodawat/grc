import fs from 'node:fs';
import path from 'node:path';
import { commandOutput, writeJson, writeMd, mdTable, repoRoot } from './v76-common.mjs';

function lines(command) {
  const out = commandOutput(command);
  return out ? out.split(/\r?\n/).filter(Boolean) : [];
}

const trackedFiles = lines('git ls-files');
const trackedZips = trackedFiles.filter((f) => f.toLowerCase().endsWith('.zip'));
const trackedDist = trackedFiles.filter((f) => f === 'dist' || f.startsWith('dist/'));
const trackedNodeModules = trackedFiles.filter((f) => f === 'node_modules' || f.startsWith('node_modules/'));
const allowedEnvTemplates = new Set([
  '.env.example',
  '.env.production.example',
  '.env.staging.example',
  '.env.development.example',
  '.env.local.example',
]);

const trackedEnv = trackedFiles.filter((f) => {
  const normalized = f.replace(/\\/g, '/');
  const base = normalized.split('/').pop();
  if (allowedEnvTemplates.has(normalized) || allowedEnvTemplates.has(base)) return false;
  return /(^|\/)\.env(\.|$)/.test(normalized) || normalized.endsWith('.env');
});

const trackedEnvTemplates = trackedFiles.filter((f) => {
  const normalized = f.replace(/\\/g, '/');
  const base = normalized.split('/').pop();
  return allowedEnvTemplates.has(normalized) || allowedEnvTemplates.has(base);
});
const trackedLogs = trackedFiles.filter((f) => f.toLowerCase().endsWith('.log'));
const generatedReleaseNoise = lines('git status --short release').filter((line) => /^\s*M\s+release\//.test(line) || /^\s*\?\?\s+release\//.test(line));

const findings = [];
function add(severity, issue, count, detail) {
  if (count > 0 || severity === 'info') findings.push({ severity, issue, count, detail });
}

add('warning', 'tracked_zip_files', trackedZips.length, trackedZips.join(', '));
add('warning', 'tracked_dist_output', trackedDist.length, trackedDist.slice(0, 10).join(', '));
add('critical', 'tracked_node_modules', trackedNodeModules.length, trackedNodeModules.slice(0, 10).join(', '));
add('critical', 'tracked_env_files', trackedEnv.length, trackedEnv.join(', '));
add('info', 'tracked_env_template_files_allowed', trackedEnvTemplates.length, trackedEnvTemplates.join(', '));
add('warning', 'tracked_log_files', trackedLogs.length, trackedLogs.slice(0, 10).join(', '));
add('info', 'generated_release_changes_currently_visible', generatedReleaseNoise.length, generatedReleaseNoise.slice(0, 20).join('\n'));

const critical = findings.filter((f) => f.severity === 'critical' && f.count > 0).length;
const warnings = findings.filter((f) => f.severity === 'warning' && f.count > 0).length;
const result = {
  generated_at: new Date().toISOString(),
  status: critical ? 'failed_critical_repo_hygiene' : warnings ? 'passed_with_warnings' : 'passed',
  critical_findings: critical,
  warning_findings: warnings,
  findings,
  note: 'This audit does not rewrite history and does not delete files.',
};

writeJson('repo-hygiene-audit.json', result);
const rows = findings.map((f) => [f.severity, f.issue, f.count, f.detail || '-']);
const md = `# v7.6 Repo Hygiene Audit\n\nGenerated: ${result.generated_at}\n\nStatus: **${result.status}**\n\n${mdTable(['Severity', 'Issue', 'Count', 'Detail'], rows)}\n\n## Safety note\n\nThis audit is read-only. It does not remove files and does not rewrite Git history.\n`;
writeMd('repo-hygiene-audit.md', md);
console.log('v7.6 repo hygiene audit generated.');
console.log(JSON.stringify({ status: result.status, critical_findings: critical, warning_findings: warnings, report: 'release/v76/repo-hygiene-audit.md' }, null, 2));
if (critical > 0) process.exitCode = 1;

