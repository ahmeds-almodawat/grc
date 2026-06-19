import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';

export const repoRoot = process.cwd();
export const releaseDir = path.join(repoRoot, 'release', 'v76');

export function ensureReleaseDir() {
  fs.mkdirSync(releaseDir, { recursive: true });
}

export function readJsonIfExists(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return { parse_error: String(error?.message || error) };
  }
}

export function writeJson(fileName, data) {
  ensureReleaseDir();
  const out = path.join(releaseDir, fileName);
  fs.writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
  return out;
}

export function writeMd(fileName, text) {
  ensureReleaseDir();
  const out = path.join(releaseDir, fileName);
  fs.writeFileSync(out, text.trim() + '\n', 'utf8');
  return out;
}

export function commandOk(command) {
  try {
    childProcess.execSync(command, { cwd: repoRoot, stdio: 'pipe', shell: true });
    return true;
  } catch {
    return false;
  }
}

export function commandOutput(command) {
  try {
    return childProcess.execSync(command, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true }).trim();
  } catch (error) {
    const stdout = error?.stdout ? String(error.stdout) : '';
    const stderr = error?.stderr ? String(error.stderr) : '';
    return (stdout + '\n' + stderr).trim();
  }
}

export function fileExists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

export function readPackageJson() {
  return readJsonIfExists(path.join(repoRoot, 'package.json'), { scripts: {} });
}

export function mdTable(headers, rows) {
  const h = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.map((v) => String(v).replace(/\n/g, '<br>')).join(' | ')} |`).join('\n');
  return [h, sep, body].filter(Boolean).join('\n');
}
