import fs from 'node:fs';
import path from 'node:path';

export const STATUS = 'technical_ready_pending_human_approval';
export const PRODUCTION_READY = false;

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text.trim() + '\n', 'utf8');
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function table(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return [head, sep, body].filter(Boolean).join('\n');
}

export function reportHeader(title) {
  return `# ${title}\n\nGenerated: ${new Date().toISOString()}\n\nStatus: **${STATUS}**\n\nProduction ready: **${PRODUCTION_READY ? 'Yes' : 'No'}**\n`;
}

export function safetyBlock() {
  return `## Safety boundary\n\n- No fake human approval.\n- No production-readiness claim.\n- No real patient identifiers.\n- No confidential OVR details.\n- No RLS, migration, runtime bridge, or Supabase function changes.\n`;
}
