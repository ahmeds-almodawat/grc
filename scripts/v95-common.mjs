import fs from 'node:fs';
import path from 'node:path';

export const status = 'technical_ready_pending_human_approval';
export const productionReady = false;
export const releaseDir = path.join('release', 'v95');

export function ensureReleaseDir() {
  fs.mkdirSync(releaseDir, { recursive: true });
}

export function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeMarkdown(fileName, content) {
  ensureReleaseDir();
  const filePath = path.join(releaseDir, fileName);
  fs.writeFileSync(filePath, content.trimStart() + '\n');
  return filePath.replace(/\\/g, '/');
}

export function markdownTable(headers, rows) {
  return [
    '| ' + headers.join(' | ') + ' |',
    '| ' + headers.map(() => '---').join(' | ') + ' |',
    ...rows.map((row) => '| ' + row.join(' | ') + ' |')
  ].join('\n');
}

export function finalBoundary() {
  return 'This pack does not fill approvals, bypass v66:strict-proof, modify RLS, modify migrations, change runtime bridge logic, or mark production ready.';
}

export function generatedAt() {
  return new Date().toISOString();
}
