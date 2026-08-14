import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const evidenceRoot = path.resolve(
  process.argv[2] || 'release/d2r-visual-evidence',
);
const manifestPath = path.join(evidenceRoot, 'capture-manifest.json');
const reviewedFindingsPath = path.join(evidenceRoot, 'reviewed-visual-findings.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const categories = {
  targetedDark: 'targeted-dark',
  darkRouteSweep: 'dark-route-sweep',
  focused: 'focused',
  mobile: 'mobile',
  rtl: 'rtl',
  light: 'light',
  responsive: 'responsive',
};

const filesFor = directory => {
  const absolute = path.join(evidenceRoot, directory);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute)
    .filter(file => /\.(png|webm)$/i.test(file))
    .sort()
    .map(file => path.posix.join(directory, file));
};

const routeIdentityPassed = route =>
  route.status === 'CAPTURED' &&
  route.routeIdentity?.passed === true &&
  route.routeIdentity?.requestedPageKey === route.pageKey &&
  route.routeIdentity?.requestedLocation === route.location &&
  route.routeIdentity?.renderedPageKey === route.pageKey &&
  route.routeIdentity?.renderedPageLocation === route.location &&
  Boolean(route.routeIdentity?.renderedHeading?.trim()) &&
  route.state?.scrollPosition?.x === 0 &&
  route.state?.scrollPosition?.y === 0 &&
  route.state?.mainScrollPosition?.x === 0 &&
  route.state?.mainScrollPosition?.y === 0;

const visualFiles = Object.fromEntries(
  Object.entries(categories).map(([key, directory]) => [key, filesFor(directory)]),
);
const visualCount = Object.values(visualFiles).reduce((sum, files) => sum + files.length, 0);
const routes = manifest.routes ?? [];
const wrongRoutes = routes.filter(route =>
  route.status === 'CAPTURE_WRONG_ROUTE' ||
  (route.status === 'CAPTURED' && !routeIdentityPassed(route)),
);
const failedRoutes = routes.filter(route => route.status !== 'CAPTURED' && route.status !== 'CAPTURE_WRONG_ROUTE');
const overflowRoutes = routes.filter(route => route.state?.pageOverflow === true);
const automatedPassed = routes.length > 0 && wrongRoutes.length === 0 && failedRoutes.length === 0 && overflowRoutes.length === 0;

let reviewedFindings = null;
if (fs.existsSync(reviewedFindingsPath)) {
  const candidate = JSON.parse(fs.readFileSync(reviewedFindingsPath, 'utf8'));
  const severities = ['critical', 'high', 'medium', 'low'];
  const valid =
    candidate.reviewStatus === 'OPERATOR_VISUAL_ACCEPTANCE_APPROVED' &&
    severities.every(severity => Array.isArray(candidate.findings?.[severity])) &&
    typeof candidate.reviewedBy === 'string' && candidate.reviewedBy.trim().length > 0 &&
    typeof candidate.reviewedAtUtc === 'string' && candidate.reviewedAtUtc.trim().length > 0;
  if (!valid) throw new Error('reviewed-visual-findings.json is present but does not contain an approved reviewed-findings contract.');
  reviewedFindings = candidate;
}

const operatorStatus = reviewedFindings
  ? 'OPERATOR_VISUAL_ACCEPTANCE_APPROVED'
  : 'OPERATOR_VISUAL_ACCEPTANCE_PENDING';
const automatedStatus = automatedPassed
  ? 'AUTOMATED_VISUAL_REGRESSION_PASS'
  : 'AUTOMATED_VISUAL_REGRESSION_FAIL';

const implementation = {
  gate: 'GRC_V13_VISUAL_STABILIZATION_D2_R',
  startingHead: '2b8bbd30048d3eac19a2e2ab98ec02ae16247a8a',
  branch: 'codex/v1.3-visual-stabilization',
  environment: 'LOCAL_VISUAL_HARNESS_ONLY',
  productionAccessed: false,
  stagingAccessed: false,
  hostedWrites: false,
  visualConclusionAuthority: 'reviewed-visual-findings.json only',
  justifiedColorExceptions: [
    'governed print/PDF output — deliberate white paper',
    'governed document preview — deliberate white paper',
    'semantic chart palette and ACC brand artwork',
  ],
  materialDashboardRedesign: false,
  securityOrAuthorizationChange: false,
};

const tests = manifest.tests ?? {};
const totals = {
  routesDiscovered: routes.length,
  routesCapturedWithIdentity: routes.filter(routeIdentityPassed).length,
  routesFailed: failedRoutes.length,
  wrongRouteCaptures: wrongRoutes.length,
  routesWithDocumentOverflow: overflowRoutes.length,
  screenshotsAndMotion: visualCount,
  ...Object.fromEntries(Object.entries(visualFiles).map(([key, files]) => [key, files.length])),
};

const inventory = {
  schema: 'grc-v13-visual-stabilization-d2r-evidence-v2',
  generatedAtUtc: new Date().toISOString(),
  automatedStatus,
  operatorStatus,
  implementation,
  totals,
  retries: routes.filter(route => (route.attempts?.length ?? route.attemptCount ?? 1) > 1),
  wrongRoutes,
  visualFiles,
  tests,
  reviewedFindings,
};

fs.writeFileSync(
  path.join(evidenceRoot, 'dark-mode-route-inventory.json'),
  `${JSON.stringify({ routes, summary: totals }, null, 2)}\n`,
  'utf8',
);
fs.writeFileSync(
  path.join(evidenceRoot, 'visual-evidence-inventory.json'),
  `${JSON.stringify(inventory, null, 2)}\n`,
  'utf8',
);
fs.writeFileSync(
  path.join(evidenceRoot, 'implementation-summary.md'),
  `# GRC v1.3 Visual Stabilization D2-R\n\n` +
  `- Starting HEAD: \`${implementation.startingHead}\`\n` +
  `- Branch: \`${implementation.branch}\`\n` +
  `- Environment: local visual harness only\n` +
  `- Automated status: **${automatedStatus}**\n` +
  `- Operator status: **${operatorStatus}**\n` +
  `- Production/staging access: **NO / NO**\n` +
  `- Hosted writes: **NO**\n\n` +
  `Automated capture and static checks do not constitute visual acceptance.\n`,
  'utf8',
);
fs.writeFileSync(
  path.join(evidenceRoot, 'test-results.json'),
  `${JSON.stringify(tests, null, 2)}\n`,
  'utf8',
);

const reviewedSummary = reviewedFindings
  ? ['critical', 'high', 'medium', 'low']
      .map(severity => `- ${severity}: ${reviewedFindings.findings[severity].length}`)
      .join('\n')
  : '- No independently reviewed findings artifact is present.\n- Remaining visual findings are intentionally not asserted.';
fs.writeFileSync(
  path.join(evidenceRoot, 'dark-mode-visual-findings.md'),
  `# D2-R Visual Review Status\n\n` +
  `## Automated result\n\n` +
  `- Status: **${automatedStatus}**\n` +
  `- Captured with route identity: **${totals.routesCapturedWithIdentity}/${totals.routesDiscovered}**\n` +
  `- Wrong-route captures: **${wrongRoutes.length}**\n` +
  `- Failed captures: **${failedRoutes.length}**\n` +
  `- Document-level overflow: **${overflowRoutes.length}**\n\n` +
  `## Visual acceptance\n\n` +
  `- Status: **${operatorStatus}**\n` +
  `${reviewedSummary}\n\n` +
  `The finalizer does not manufacture PASS decisions or empty findings.\n`,
  'utf8',
);

const cards = Object.entries(visualFiles).map(([category, files]) =>
  `<section><h2>${category} (${files.length})</h2><div class="grid">${files.map(file =>
    `<figure><img loading="lazy" src="${file}" alt="${path.basename(file)}"><figcaption>${file}</figcaption></figure>`
  ).join('')}</div></section>`
).join('');
fs.writeFileSync(
  path.join(evidenceRoot, 'dark-mode-visual-audit-index.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GRC v1.3 D2-R Visual Evidence</title><style>body{font-family:system-ui;background:#071321;color:#edf5fc;margin:0;padding:24px}h1,h2{color:#fff}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}figure{margin:0;padding:12px;border:1px solid #31475f;border-radius:12px;background:#102034}img{display:block;width:100%;height:auto;border-radius:8px}figcaption{overflow-wrap:anywhere;margin-top:8px;color:#b8c8d9;font-size:12px}</style></head><body><h1>GRC v1.3 Visual Stabilization D2-R</h1><p>${automatedStatus} · ${operatorStatus}</p>${cards}</body></html>\n`,
  'utf8',
);

const scanCandidates = fs.readdirSync(evidenceRoot, { recursive: true })
  .map(item => String(item))
  .filter(item => /\.(json|md|html|txt|csv|mjs)$/i.test(item));
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|RESEND_API_KEY|OCRSPACE_API_KEY)\s*[=:]\s*\S+/i,
  /\beyJ[a-zA-Z0-9_-]{16,}\.[a-zA-Z0-9_-]{16,}\.[a-zA-Z0-9_-]{8,}\b/,
  /postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@/i,
];
const secretFindings = [];
for (const relative of scanCandidates) {
  const text = fs.readFileSync(path.join(evidenceRoot, relative), 'utf8');
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) secretFindings.push({ file: relative, pattern: String(pattern) });
  }
}
const secretReport = {
  passed: secretFindings.length === 0,
  scannedTextFiles: scanCandidates.length,
  findings: secretFindings,
  binaryCapturePolicy: 'Captures contain only synthetic local fixtures; browser storage, cookies, tokens and environment files are excluded.',
};
fs.writeFileSync(path.join(evidenceRoot, 'secret-scan.json'), `${JSON.stringify(secretReport, null, 2)}\n`, 'utf8');

const checksumTargets = fs.readdirSync(evidenceRoot, { recursive: true })
  .map(item => String(item))
  .filter(relative => !relative.endsWith('sha256sums.txt'))
  .filter(relative => fs.statSync(path.join(evidenceRoot, relative)).isFile())
  .sort();
const checksumLines = checksumTargets.map(relative => {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(evidenceRoot, relative))).digest('hex');
  return `${hash}  ${relative.replaceAll('\\', '/')}`;
});
fs.writeFileSync(path.join(evidenceRoot, 'sha256sums.txt'), `${checksumLines.join('\n')}\n`, 'utf8');

console.log(JSON.stringify({
  evidenceRoot,
  automatedStatus,
  operatorStatus,
  routesCapturedWithIdentity: `${totals.routesCapturedWithIdentity}/${totals.routesDiscovered}`,
  wrongRouteCaptures: wrongRoutes.length,
  screenshotsAndMotion: visualCount,
  secretScan: secretReport.passed ? 'PASS' : 'FAIL',
}, null, 2));

if (!secretReport.passed || !automatedPassed) process.exit(1);
