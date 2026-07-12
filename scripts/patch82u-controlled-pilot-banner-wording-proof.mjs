import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
const results = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`✅ ${name}`);
    results.push({ name, pass: true, detail });
  } else {
    failed++;
    console.error(`❌ ${name}`);
    if (detail) console.error(`   ${detail}`);
    results.push({ name, pass: false, detail });
  }
}

const packageJson = fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8');
check('package.json contains patch82u:proof', packageJson.includes('patch82u:proof'));

const bannerContent = fs.readFileSync(path.join(rootDir, 'src/components/ControlledPilotBanner.tsx'), 'utf8');
check('ControlledPilotBanner or equivalent no longer contains global “Synthetic data only”', !bannerContent.includes('Synthetic data only'));

const pages = [
  'Risks.tsx', 'OVR.tsx', 'Projects.tsx', 'Evidence.tsx', 'Audit.tsx', 'Compliance.tsx', 'Governance.tsx', 'Dashboard.tsx'
];
let noScaryWording = true;
let noSynthetic = true;

for (const page of pages) {
  const p = fs.readFileSync(path.join(rootDir, 'src/pages', page), 'utf8');
  if (p.includes('Synthetic data only') || p.includes('mock data') || p.includes('demo mode')) {
    noSynthetic = false;
  }
  if (p.includes('Not production')) {
    noScaryWording = false;
  }
}
check('Normal product pages do not contain visible “Synthetic data only”, “mock data”, or “demo mode”', noSynthetic);
check('Normal product pages do not contain scary generic “Not production” wording', noScaryWording);

check('Internal readiness pages still contain clear readiness/review warning wording', bannerContent.includes('Internal readiness tool'));

const layoutContent = fs.readFileSync(path.join(rootDir, 'src/components/Layout.tsx'), 'utf8');
check('App/Layout still preserve role gating through existing access helpers', layoutContent.includes('SUPER_ADMIN_ONLY_PAGES'));

const allCode = [bannerContent, layoutContent];
let noForbidden = true;
for (const code of allCode) {
  if (code.toLowerCase().includes('system is production ready') ||
      code.toLowerCase().includes('go-live complete') ||
      code.toLowerCase().includes('production launched') ||
      code.toLowerCase().includes('transition_to_live_operations')) {
    noForbidden = false;
  }
}
check('Forbidden phrases are absent', noForbidden);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed.');
}
