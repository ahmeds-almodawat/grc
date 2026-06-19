import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export function exists(p) {
  return fs.existsSync(p);
}

export function read(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

export function listFiles(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const item of fs.readdirSync(d)) {
      const full = path.join(d, item);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (predicate(full)) out.push(full);
    }
  };
  walk(dir);
  return out.sort();
}

export function safeExec(command) {
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, output };
  } catch (error) {
    return { ok: false, output: `${error.stdout || ''}\n${error.stderr || ''}`.trim() };
  }
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function writeText(file, text) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, text);
}

export function status(ok, label, details = '') {
  return { ok, label, details };
}
