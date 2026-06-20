import fs from 'node:fs';
import path from 'node:path';

export const STATUS = 'technical_ready_pending_human_approval';
export const PRODUCTION_READY = false;

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJsonSafe(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

export function exists(filePath) {
  return fs.existsSync(filePath);
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

export function writeMd(filePath, lines) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

export function table(headers, rows) {
  const header = '| ' + headers.join(' | ') + ' |';
  const divider = '| ' + headers.map(() => '---').join(' | ') + ' |';
  const body = rows.map((row) => '| ' + row.join(' | ') + ' |');
  return [header, divider, ...body];
}

export function proofSummary() {
  const proof = readJsonSafe('release/v700/proof-suite-all.json', {});
  return {
    status: proof.status || 'unknown_or_not_generated',
    passed_count: proof.passed_count ?? 'unknown',
    failed_count: proof.failed_count ?? 'unknown',
    failed_commands: Array.isArray(proof.failed_commands) ? proof.failed_commands : []
  };
}

export function signoffPaths() {
  return {
    pilotSignoff: 'release/v674/approvals/pilot-signoff.json',
    confidentiality: 'release/v674/approvals/ovr-confidentiality-confirmation.json'
  };
}

export function printResult(label, result) {
  console.log(label);
  console.log(JSON.stringify(result, null, 2));
}
