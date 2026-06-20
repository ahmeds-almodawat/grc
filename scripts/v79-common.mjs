import fs from 'fs';
import path from 'path';
export const releaseDir = path.join(process.cwd(), 'release', 'v79');
fs.mkdirSync(releaseDir, { recursive: true });
export function readJsonSafe(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
export function writeJson(name, data) { fs.writeFileSync(path.join(releaseDir, name), JSON.stringify(data, null, 2) + '\n'); }
export function writeText(name, text) { fs.writeFileSync(path.join(releaseDir, name), text.trimStart() + '\n'); }
export function mdTable(headers, rows) { const esc=(v)=>String(v??'').replace(/\n/g,'<br>'); return [`| ${headers.map(esc).join(' | ')} |`,`| ${headers.map(()=>'---').join(' | ')} |`,...rows.map(r=>`| ${r.map(esc).join(' | ')} |`)].join('\n'); }
export function currentStatus() { const s=readJsonSafe(path.join(process.cwd(),'release','v674','v674-signoff-check.json'),{}); const p=readJsonSafe(path.join(process.cwd(),'release','v700','proof-suite-all.json'),{}); const sign=Boolean(s?.strict_passed||(s?.signoff_valid&&s?.confidentiality_valid)); const proof=p?.status==='passed'||p?.failed_count===0; return sign&&proof?'controlled_pilot_ready_after_human_approval':'technical_ready_pending_human_approval'; }
export function safeStatusJson(extra={}) { return { generated_at:new Date().toISOString(), status:currentStatus(), production_ready:false, human_approval_required:true, no_fake_approval:true, ...extra }; }
