import { spawn } from 'node:child_process';

const lanes = {
  fast: ['validate:fast'],
  release: ['validate:release'],
};

const lane = process.argv[2] ?? 'fast';
const commands = lanes[lane];

if (!commands) {
  console.error(`Unknown validation profile lane: ${lane}`);
  console.error(`Supported lanes: ${Object.keys(lanes).join(', ')}`);
  process.exit(1);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function formatDuration(ms) {
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    console.log(`\n=== npm run ${scriptName} ===`);
    const child = spawn(npmCommand, ['run', scriptName], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', reject);
    child.on('close', code => {
      const durationMs = Date.now() - startedAt;
      const result = { script: scriptName, code, duration_ms: durationMs, duration: formatDuration(durationMs) };
      console.log(`=== ${scriptName} finished in ${result.duration} with exit code ${code} ===`);
      if (code === 0) resolve(result);
      else {
        const error = new Error(`${scriptName} failed with exit code ${code}`);
        error.result = result;
        reject(error);
      }
    });
  });
}

const startedAt = Date.now();
const results = [];

try {
  for (const command of commands) {
    results.push(await runScript(command));
  }
  const totalMs = Date.now() - startedAt;
  console.log('\nValidation profile complete.');
  console.log(JSON.stringify({
    lane,
    status: 'passed',
    total_duration_ms: totalMs,
    total_duration: formatDuration(totalMs),
    results,
  }, null, 2));
} catch (error) {
  const totalMs = Date.now() - startedAt;
  console.error('\nValidation profile failed.');
  console.error(JSON.stringify({
    lane,
    status: 'failed',
    total_duration_ms: totalMs,
    total_duration: formatDuration(totalMs),
    results,
    failed: error.result ?? { message: error.message },
  }, null, 2));
  process.exit(1);
}
