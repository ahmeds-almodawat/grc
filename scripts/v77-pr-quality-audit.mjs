import {lines,table,writeJson,writeMd} from './v77-common.mjs';
const trackedZips=lines('git ls-files "*.zip"'); const trackedEnv=lines('git ls-files ".env" ".env.local" ".env.production" ".env.staging" ".env.development"'); const status=lines('git status --short');
const findings=[]; const add=(sev,issue,count,detail)=>{if(count>0||sev==='info')findings.push({severity:sev,issue,count,detail})};
add('critical','tracked_zip_files',trackedZips.length,trackedZips.join(', ')); add('critical','tracked_real_env_files',trackedEnv.length,trackedEnv.join(', ')); add('info','visible_working_tree_changes',status.length,status.slice(0,40).join('\n'));
const critical=findings.filter(f=>f.severity==='critical'&&f.count>0).length; const result={generated_at:new Date().toISOString(),status:critical?'failed_pr_quality_critical':'passed',critical_findings:critical,findings};
writeJson('pr-quality-audit.json',result); writeMd('pr-quality-audit.md',`# v7.7 PR Quality Audit\n\nGenerated: ${result.generated_at}\n\nStatus: **${result.status}**\n\n${table(['Severity','Issue','Count','Detail'],findings.map(f=>[f.severity,f.issue,f.count,f.detail||'-']))}\n`);
console.log('v7.7 PR quality audit generated.'); console.log(JSON.stringify({status:result.status,critical_findings:critical,report:'release/v77/pr-quality-audit.md'},null,2)); if(critical) process.exitCode=1;
