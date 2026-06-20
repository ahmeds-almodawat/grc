import fs from 'fs';
import path from 'path';

export const ROOT = process.cwd();

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJsonSafe(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(file, data) {
  const full = path.join(ROOT, file);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function writeText(file, text) {
  const full = path.join(ROOT, file);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, text.trimStart() + '\n', 'utf8');
}

export function mdTable(headers, rows) {
  const escape = (value) => String(value ?? '').replace(/\n/g, '<br>').replace(/\|/g, '\\|');
  return [
    `| ${headers.map(escape).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(escape).join(' | ')} |`),
  ].join('\n');
}

export function currentGateStatus() {
  const proof = readJsonSafe('release/v700/proof-suite-all.json', {});
  const signoff = readJsonSafe('release/v674/v674-signoff-check.json', {});
  const fullyPassed = proof?.status === 'passed' || proof?.failed_count === 0;
  const signoffPassed = signoff?.strict_passed === true || (signoff?.signoff_valid === true && signoff?.confidentiality_valid === true);
  if (fullyPassed && signoffPassed) return 'controlled_pilot_approval_evidence_complete';
  return 'technical_ready_pending_human_approval';
}

export function safetyBlock() {
  return `
## Safety boundaries

This artifact does not:

- fake approval;
- mark production ready;
- bypass \`v66:strict-proof\`;
- authorize real patient identifiers;
- authorize confidential OVR details;
- modify RLS, migrations, runtime bridge logic, or Supabase functions.
`;
}

export function emitPack({ version, title, rows, files, jsonName, mdName }) {
  const status = currentGateStatus();
  const generated_at = new Date().toISOString();
  const data = {
    version,
    title,
    generated_at,
    status,
    production_ready: false,
    items: rows.length,
    files,
    rows: rows.map(([area, output, owner, decision]) => ({ area, output, owner, decision })),
  };
  writeJson(`release/${version}/${jsonName}`, data);
  const md = `# ${title}\n\nGenerated: ${generated_at}\n\nStatus: **${status}**\n\nProduction ready: **false**\n\n${mdTable(['Area', 'Output', 'Owner', 'Decision / Use'], rows)}\n\n${safetyBlock()}\n`;
  writeText(`release/${version}/${mdName}`, md);
  return data;
}
