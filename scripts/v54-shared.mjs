import fs from 'fs';
import path from 'path';

export function exists(filePath) {
  return fs.existsSync(path.resolve(filePath));
}

export function ensureDir(dirPath) {
  fs.mkdirSync(path.resolve(dirPath), { recursive: true });
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(path.resolve(filePath), JSON.stringify(data, null, 2) + '\n');
}

export function writeMarkdown(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(path.resolve(filePath), content.trim() + '\n');
}

export function scanFileContains(filePath, patterns) {
  if (!exists(filePath)) return false;
  const text = fs.readFileSync(path.resolve(filePath), 'utf8');
  return patterns.every((pattern) => text.includes(pattern));
}

export function score(items) {
  const total = items.length;
  const passed = items.filter((item) => item.status === 'passed').length;
  return total === 0 ? 0 : Math.round((passed / total) * 100);
}

export function statusFromBoolean(condition) {
  return condition ? 'passed' : 'needs_review';
}
