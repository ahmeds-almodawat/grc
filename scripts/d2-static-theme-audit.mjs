import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const sourceExtensions = new Set(['.ts', '.tsx']);
const stylesheetExtension = '.css';
const inlineLiteralPattern = /(?:background(?:Color)?|borderColor|color)\s*:\s*['"](?:white|black|#[0-9a-f]{3,8}|rgba?\([^)]*\))['"]/i;
const sourceExemptions = new Set([
  'src/components/OvrPrintableReport.tsx',
  'src/dashboard/dashboardFramework.ts',
]);
const cssExceptionSelector = /(?:print|pdf|paper|document-preview|governed-print|brand|logo|chart|graph|sparkline|::before|::after|\bbutton\b|\.nav-)/i;
const surfaceClassPattern = /(?:card|panel|tile|container|hero|banner|row|item|strip|frame|state|filters|header|preview|check|rule|workbench|workflow|capability|list|chain|assurance|gap|metric|table)/i;
const semanticBackground = /\bbackground(?:-color)?\s*:[^;]*(?:var\(--color-(?:surface|input|table|warning|danger|success|info|neutral)|var\(--ui-surface|var\(--surface)/i;

function hasRiskySurfaceBackground(declarations) {
  const backgroundValues = [...declarations.matchAll(/\bbackground(?:-color)?\s*:\s*([^;]+)/gi)]
    .map(match => match[1].trim().toLowerCase());
  return backgroundValues.some(value => {
    if (/^(?:#fff(?:fff)?\b|white\b|#f8fafc\b|#f1f5f9\b|#eef2f7\b)/.test(value)) return true;
    const whiteRgb = value.match(/rgba?\(\s*255\s*,\s*255\s*,\s*255\s*(?:,\s*([\d.]+))?\s*\)/);
    if (!whiteRgb) return false;
    const alpha = whiteRgb[1] === undefined ? 1 : Number(whiteRgb[1]);
    return Number.isFinite(alpha) && alpha >= 0.5;
  });
}

function walk(directory, extensions) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute, extensions);
    return extensions.has(path.extname(entry.name)) ? [absolute] : [];
  });
}

function stripMediaPrint(css) {
  let result = '';
  let cursor = 0;
  const lower = css.toLowerCase();
  while (cursor < css.length) {
    const start = lower.indexOf('@media print', cursor);
    if (start === -1) return result + css.slice(cursor);
    result += css.slice(cursor, start);
    const open = css.indexOf('{', start);
    if (open === -1) return result;
    let depth = 1;
    let index = open + 1;
    while (index < css.length && depth > 0) {
      if (css[index] === '{') depth += 1;
      if (css[index] === '}') depth -= 1;
      index += 1;
    }
    cursor = index;
  }
  return result;
}

function cssRules(css) {
  const rules = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(rulePattern)) {
    rules.push({ selector: match[1].trim(), declarations: match[2].trim() });
  }
  return rules;
}

const findings = [];
for (const absolute of walk(sourceRoot, sourceExtensions)) {
  const relative = path.relative(root, absolute).replaceAll('\\', '/');
  if (sourceExemptions.has(relative)) continue;
  const lines = readFileSync(absolute, 'utf8').replace(/\r\n/g, '\n').split('\n');
  lines.forEach((line, index) => {
    if (inlineLiteralPattern.test(line)) {
      findings.push({ kind: 'inline-source-color', file: relative, line: index + 1 });
    }
  });
}

const stylesheetFiles = walk(sourceRoot, new Set([stylesheetExtension]));
const rules = stylesheetFiles.flatMap(absolute => {
  const relative = path.relative(root, absolute).replaceAll('\\', '/');
  const screenCss = stripMediaPrint(readFileSync(absolute, 'utf8').replace(/\r\n/g, '\n'));
  return cssRules(screenCss).map(rule => ({ ...rule, file: relative }));
});
const darkSemanticClasses = new Set();
for (const rule of rules) {
  if (!/:root\[data-theme=["']dark["']\]/.test(rule.selector)) continue;
  if (!semanticBackground.test(rule.declarations)) continue;
  for (const classMatch of rule.selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
    darkSemanticClasses.add(classMatch[1]);
  }
}

const cssResolvedHardcodedDeclarations = [];
for (const rule of rules) {
  if (/:root\[data-theme=["']dark["']\]/.test(rule.selector)) continue;
  if (cssExceptionSelector.test(rule.selector)) continue;
  if (!hasRiskySurfaceBackground(rule.declarations)) continue;
  const classes = [...rule.selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)]
    .map(match => match[1])
    .filter(className => surfaceClassPattern.test(className));
  if (classes.length === 0) continue;
  const unresolved = classes.filter(className => !darkSemanticClasses.has(className));
  if (unresolved.length > 0) {
    findings.push({
      kind: 'screen-css-light-surface-without-dark-mapping',
      file: rule.file,
      selector: rule.selector,
      unresolvedClasses: [...new Set(unresolved)],
    });
  } else {
    cssResolvedHardcodedDeclarations.push({
      selector: rule.selector,
      mappedClasses: [...new Set(classes)],
    });
  }
}

console.log(JSON.stringify({
  audit: 'GRC_V13_D2_R_STATIC_THEME_COLOR_AUDIT',
  scannedRoots: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.css'],
  supportingEvidenceOnly: true,
  excludedCssScopes: [
    '@media print',
    'governed white-paper/document preview',
    'brand/logo artwork',
    'chart/graph palettes',
  ],
  allowedSourceExceptions: [...sourceExemptions],
  cssResolvedHardcodedDeclarationCount: cssResolvedHardcodedDeclarations.length,
  findings,
  passed: findings.length === 0,
}, null, 2));

if (findings.length > 0) process.exitCode = 1;
