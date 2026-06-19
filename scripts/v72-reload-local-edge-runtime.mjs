import { spawnSync } from 'node:child_process';

const root = process.cwd();
const npx = 'npx';

function run(args) {
  return spawnSync(npx, ['supabase', ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
    windowsHide: true,
    shell: process.platform === 'win32',
  });
}

console.log('Reloading the local Supabase stack so the v7.2 Edge Function is registered...');
const stop = run(['stop']);
if (stop.status !== 0) process.exit(stop.status || 1);
const start = run(['start']);
if (start.status !== 0) process.exit(start.status || 1);
console.log('Local Supabase Edge Runtime reloaded.');
