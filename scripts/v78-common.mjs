import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

export const releaseDir = path.join(process.cwd(), 'release', 'v78');

export function ensureReleaseDir() {
  fs.mkdirSync(releaseDir, { recursive: true });
}

export function readJsonSafe(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(name, data) {
  ensureReleaseDir();
  fs.writeFileSync(path.join(releaseDir, name), JSON.stringify(data, null, 2) + '\n');
}

export function writeMd(name, content) {
  ensureReleaseDir();
  fs.writeFileSync(path.join(releaseDir, name), content.trimEnd() + '\n');
}

export function lines(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function mdTable(headers, rows) {
  const header = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.map((cell) => String(cell ?? '').replace(/\n/g, '<br>')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

export function proofSummary() {
  const proof = readJsonSafe(path.join(process.cwd(), 'release', 'v700', 'proof-suite-all.json'), {});
  return {
    status: proof.status ?? 'unknown',
    passed_count: proof.passed_count ?? null,
    failed_count: proof.failed_count ?? null,
    failed_commands: proof.failed_commands ?? [],
  };
}

export function signoffSummary() {
  const signoff = readJsonSafe(path.join(process.cwd(), 'release', 'v674', 'v674-signoff-check.json'), {});
  return {
    signoff_valid: Boolean(signoff.signoff_valid),
    confidentiality_valid: Boolean(signoff.confidentiality_valid),
    strict_passed: Boolean(signoff.strict_passed),
  };
}

export function statusFromApprovals() {
  const signoff = signoffSummary();
  if (signoff.signoff_valid && signoff.confidentiality_valid && signoff.strict_passed) {
    return 'approved_for_controlled_pilot_review';
  }
  return 'technical_ready_pending_human_approval';
}
