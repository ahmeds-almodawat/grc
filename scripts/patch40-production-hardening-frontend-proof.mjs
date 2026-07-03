import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch40');

async function read(relativePath) {
  try {
    return await readFile(path.join(root, relativePath), 'utf8');
  } catch (err) {
    return '';
  }
}

const findings = [];

// 1. Verify files exist
const checkFiles = [
  'src/lib/productionReadinessApi.ts',
  'src/pages/ProductionReadinessCenter.tsx',
  'release/patch40/proof-suite-consolidation-notes.md',
];

for (const file of checkFiles) {
  const content = await read(file);
  if (!content) {
    findings.push(`File missing or empty: ${file}`);
  }
}

// 2. Verify route/navigation integration
const appContent = await read('src/App.tsx');
if (!appContent.includes('ProductionReadinessCenter')) {
  findings.push('ProductionReadinessCenter import or case statement missing in src/App.tsx');
}

const layoutContent = await read('src/components/Layout.tsx');
if (!layoutContent.includes('productionReadiness')) {
  findings.push('productionReadiness key missing in Layout.tsx');
}

const authContent = await read('src/auth/authAccess.ts');
if (!authContent.includes('productionReadiness')) {
  findings.push('productionReadiness permission mapping missing in authAccess.ts');
}

const i18nContent = await read('src/i18n/I18nContext.tsx');
if (!i18nContent.includes('nav.productionReadiness')) {
  findings.push('nav.productionReadiness translation key missing in I18nContext.tsx');
}

// 3. Verify no forbidden static mock keywords in frontend page or API
const pageContent = await read('src/pages/ProductionReadinessCenter.tsx');
const forbiddenKeywords = ['mock', 'fake', 'dummy', 'fallback'];
for (const word of forbiddenKeywords) {
  if (pageContent.toLowerCase().includes(`'${word}'`) || pageContent.toLowerCase().includes(`"${word}"`)) {
    findings.push(`ProductionReadinessCenter page introduces forbidden static word: '${word}'`);
  }
}

const proof = {
  generated_at: new Date().toISOString(),
  findings,
  status: findings.length ? 'failed' : 'passed',
  blocking_count: findings.length,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch40-frontend-proof.json'), `${JSON.stringify(proof, null, 2)}\n`);

if (findings.length) {
  console.error(`Patch 40 Production Hardening frontend proof failed:\n- ${findings.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 40 Production Hardening frontend proof passed.');
}
