import fs from 'node:fs';
import path from 'node:path';

export const STATUS_PENDING = 'technical_ready_pending_human_approval';
export const PRODUCTION_READY = false;
export const SCOPE_TEXT = 'Controlled internal pilot for GRC Control Center using synthetic/non-confidential data only. Pilot limited to 5–15 internal users. No real patient identifiers. No confidential OVR details. No production rollout.';

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return { __read_error: String(error.message || error) };
  }
}

export function writeMarkdown(filePath, lines) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

export function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

export function isPlaceholder(value) {
  if (typeof value !== 'string') return true;
  const normalized = value.trim().toLowerCase();
  return !normalized || ['tbd', 'todo', 'placeholder', 'name', 'role', 'pending', 'n/a', 'na'].includes(normalized) || normalized.includes('placeholder');
}

export function hasControlledPilotScope(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.toLowerCase();
  return normalized.includes('controlled') && normalized.includes('pilot') && !normalized.includes('production rollout');
}

export function notFutureDate(value) {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return date.getTime() <= todayUtc.getTime();
}

export function boolTrue(value) {
  return value === true;
}
