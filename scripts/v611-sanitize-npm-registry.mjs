import fs from 'node:fs';
import path from 'node:path';

const releaseDir = path.resolve('release', 'v611');
const backupDir = path.join(releaseDir, 'backups');
fs.mkdirSync(backupDir, { recursive: true });

const INTERNAL_REGISTRY_RE = /^https?:\/\/packages\.applied-caas-gateway[^/]*\.internal\.api\.openai\.org\/artifactory\/api\/npm\/npm-public\//;
const PUBLIC_REGISTRY = 'https://registry.npmjs.org/';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

function walk(value, callback, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, callback, [...trail, String(index)]));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      callback(value, key, child, [...trail, key]);
      walk(child, callback, [...trail, key]);
    }
  }
}

const lockPath = path.resolve('package-lock.json');
let lockChanged = false;
let lockReplacements = [];
if (fs.existsSync(lockPath)) {
  const raw = fs.readFileSync(lockPath, 'utf8');
  fs.writeFileSync(path.join(backupDir, `package-lock.${timestamp}.json`), raw);
  const lock = JSON.parse(raw);

  walk(lock, (parent, key, child, trail) => {
    if (key === 'resolved' && typeof child === 'string' && INTERNAL_REGISTRY_RE.test(child)) {
      const next = child.replace(INTERNAL_REGISTRY_RE, PUBLIC_REGISTRY);
      parent[key] = next;
      lockChanged = true;
      lockReplacements.push({ path: trail.join('.'), before: child, after: next });
    }
  });

  if (lockChanged) {
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
  }
}

const npmrcPath = path.resolve('.npmrc');
let npmrcChanged = false;
let npmrcCreated = false;
let npmrcBefore = null;
if (fs.existsSync(npmrcPath)) {
  npmrcBefore = fs.readFileSync(npmrcPath, 'utf8');
  fs.writeFileSync(path.join(backupDir, `.npmrc.${timestamp}.bak`), npmrcBefore);
  let next = npmrcBefore.replace(/registry\s*=\s*https?:\/\/packages\.applied-caas-gateway[^\s]+/g, `registry=${PUBLIC_REGISTRY}`);
  if (!/^registry\s*=\s*https:\/\/registry\.npmjs\.org\/?/m.test(next)) {
    next = `${next.trim()}\nregistry=${PUBLIC_REGISTRY}\n`;
  }
  if (next !== npmrcBefore) {
    fs.writeFileSync(npmrcPath, next.endsWith('\n') ? next : `${next}\n`);
    npmrcChanged = true;
  }
} else {
  fs.writeFileSync(npmrcPath, `registry=${PUBLIC_REGISTRY}\n`);
  npmrcCreated = true;
  npmrcChanged = true;
}

const report = {
  generated_at: new Date().toISOString(),
  package_lock_present: fs.existsSync(lockPath),
  lock_changed: lockChanged,
  lock_resolved_url_replacements: lockReplacements.length,
  npmrc_changed: npmrcChanged,
  npmrc_created: npmrcCreated,
  public_registry: PUBLIC_REGISTRY,
  note: 'This only removes internal OpenAI registry URLs from the local project lock/config. It does not change package versions.'
};

fs.writeFileSync(path.join(releaseDir, 'v611-registry-sanitize-report.json'), JSON.stringify({ ...report, lockReplacements }, null, 2) + '\n');
console.log('v6.1.1 registry sanitize complete.');
console.log(JSON.stringify(report, null, 2));
