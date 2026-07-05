import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release', 'patch75');
fs.mkdirSync(outDir, { recursive: true });

const results = {
  patch: 75,
  name: 'Clinical UX and Navigation Simplification',
  checks: [],
  passed: false,
};

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function verifyLayout() {
  const content = read('src/components/Layout.tsx');
  const primaryNavMatch = content.match(/const primaryNav: NavItem\[\] = \[([\s\S]*?)\];/);
  if (!primaryNavMatch) {
    return { name: 'primaryNav missing', passed: false };
  }
  const block = primaryNavMatch[1];
  const noOperatorConsole = !block.includes(`key: 'productionOperatorConsole'`);
  const noEvidenceClosure = !block.includes(`key: 'productionEvidenceClosure'`);
  return {
    name: 'Layout primaryNav cleanup',
    passed: noOperatorConsole && noEvidenceClosure,
    details: { noOperatorConsole, noEvidenceClosure }
  };
}

function verifyApp() {
  const content = read('src/App.tsx');
  
  const grcHubMatch = content.match(/function GrcHub\(\) \{([\s\S]*?)return \(/);
  const grcHubClean = !!grcHubMatch && !grcHubMatch[1].includes(`id: 'operatingCore'`);

  const qsHubMatch = content.match(/function QualitySafetyHub\(\) \{([\s\S]*?)return \(/);
  const qsHubClean = !!qsHubMatch && !qsHubMatch[1].includes(`id: 'qualityAccreditationOperating'`);

  return {
    name: 'App.tsx Hub tabs cleanup',
    passed: grcHubClean && qsHubClean,
    details: { grcHubClean, qsHubClean }
  };
}

function verifyAuthAccess() {
  const content = read('src/auth/authAccess.ts');
  const noAdminHubDefault = !content.includes(`return 'adminHub';`);
  const dailyOpsDefault = content.includes(`return 'dailyOperationsHub';`);
  return {
    name: 'authAccess.ts admin default routing',
    passed: noAdminHubDefault && dailyOpsDefault,
    details: { noAdminHubDefault, dailyOpsDefault }
  };
}

try {
  results.checks.push(verifyLayout());
  results.checks.push(verifyApp());
  results.checks.push(verifyAuthAccess());
  results.passed = results.checks.every(c => c.passed);
} catch (error) {
  results.error = error.message;
  results.passed = false;
}

const outFile = path.join(outDir, 'patch75-clinical-ux-navigation-simplification-proof.json');
fs.writeFileSync(outFile, JSON.stringify(results, null, 2));

if (results.passed) {
  console.log('✅ Patch 75: Clinical UX and Navigation Simplification Proof Passed');
  process.exit(0);
} else {
  console.error('❌ Patch 75: Proof Failed');
  console.error(JSON.stringify(results, null, 2));
  process.exit(1);
}
