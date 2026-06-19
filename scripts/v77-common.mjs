import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
export const ROOT=process.cwd(); export const OUT=path.join(ROOT,'release','v77'); fs.mkdirSync(OUT,{recursive:true});
export function readJson(rel,fallback={}){try{return JSON.parse(fs.readFileSync(path.join(ROOT,rel),'utf8'))}catch{return fallback}}
export function exists(rel){return fs.existsSync(path.join(ROOT,rel))}
export function lines(cmd){try{return execSync(cmd,{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','ignore']}).split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}catch{return[]}}
export function command(cmd){try{return execSync(cmd,{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()}catch(e){return String(e?.stdout||e?.stderr||e?.message||'').trim()}}
export function writeJson(n,d){fs.writeFileSync(path.join(OUT,n),JSON.stringify(d,null,2)+'\n')}
export function writeMd(n,d){fs.writeFileSync(path.join(OUT,n),d.trim()+'\n')}
export function table(h,rows){const e=v=>String(v??'').replace(/\n/g,'<br>').replace(/\|/g,'\\|');return [`| ${h.map(e).join(' | ')} |`,`| ${h.map(()=> '---').join(' | ')} |`,...rows.map(r=>`| ${r.map(e).join(' | ')} |`)].join('\n')}
export function status(){const proof=readJson('release/v700/proof-suite-all.json',{});const sign=readJson('release/v674/v674-signoff-check.json',{});const failed=Array.isArray(proof.failed_commands)?proof.failed_commands:[];if((proof.status==='passed'||failed.length===0)&&sign.strict_passed===true)return 'controlled_pilot_ready';if(failed.length===1&&failed[0]==='v66:strict-proof')return 'technical_ready_pending_human_approval';return proof.status||'technical_ready_pending_human_approval'}
export function snapshot(){return {generated_at:new Date().toISOString(),branch:command('git branch --show-current')||'unknown',status:status(),proof_suite:readJson('release/v700/proof-suite-all.json',{}),signoff_check:readJson('release/v674/v674-signoff-check.json',{}),module_acceptance:readJson('release/v73/module-acceptance-results.json',{}),repo_hygiene:readJson('release/v76/repo-hygiene-audit.json',{})}}
