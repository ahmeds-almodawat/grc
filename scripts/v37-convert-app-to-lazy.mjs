#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const appPath = path.resolve('src/App.tsx');
const backupPath = path.resolve('src/App.pre-v37-lazy-backup.tsx');

if (!fs.existsSync(appPath)) {
  console.error('Cannot find src/App.tsx. Run this script from the project root.');
  process.exit(1);
}

let source = fs.readFileSync(appPath, 'utf8');

if (source.includes('src/App.pre-v37-lazy-backup') || source.includes('lazy(() => import(\'./pages/')) {
  console.log('App.tsx already appears to use lazy page imports. No conversion needed.');
  process.exit(0);
}

if (!fs.existsSync(backupPath)) {
  fs.writeFileSync(backupPath, source);
}

const pageImports = [];
const importRegex = /^import\s+(?:(?:\{\s*([A-Za-z0-9_$]+)\s*\})|([A-Za-z0-9_$]+))\s+from\s+['"](\.\/pages\/[^'"]+)['"];\s*$/gm;

source = source.replace(importRegex, (full, namedImport, defaultImport, importPath) => {
  const componentName = namedImport || defaultImport;
  const isNamed = Boolean(namedImport);
  pageImports.push({ componentName, importPath, isNamed });
  return '';
});

if (pageImports.length === 0) {
  console.error('No page imports were found in src/App.tsx. Nothing converted.');
  process.exit(1);
}

// Make React import include Suspense and lazy.
source = source.replace(/^import\s+\{([^}]+)\}\s+from\s+['"]react['"];\s*$/m, (full, specifiers) => {
  const parts = specifiers.split(',').map(part => part.trim()).filter(Boolean);
  for (const needed of ['Suspense', 'lazy']) {
    if (!parts.includes(needed)) parts.unshift(needed);
  }
  return `import { ${parts.join(', ')} } from 'react';`;
});

if (!source.includes("from 'react';") || !source.includes('lazy')) {
  source = `import { Suspense, lazy } from 'react';\n${source}`;
}

if (!source.includes("./components/PageLoading")) {
  source = source.replace(/(import\s+[^\n]+from\s+['"]\.\/components\/TabbedHub['"];\s*)/, `$1\nimport { PageLoading } from './components/PageLoading';`);
  if (!source.includes("./components/PageLoading")) {
    source = source.replace(/(import\s+[^\n]+;\s*)/, `$1\nimport { PageLoading } from './components/PageLoading';`);
  }
}

const lazyBlock = [
  '// v3.7: page modules are loaded on demand to reduce the initial JS bundle.',
  ...pageImports.map(({ componentName, importPath, isNamed }) => {
    if (isNamed) {
      return `const ${componentName} = lazy(() => import('${importPath}').then(module => ({ default: module.${componentName} })));`;
    }
    return `const ${componentName} = lazy(() => import('${importPath}'));`;
  }),
  '',
].join('\n');

const insertionMarkers = [
  'function ExecutiveHub',
  'export default function App',
  'function App',
];
let inserted = false;
for (const marker of insertionMarkers) {
  const idx = source.indexOf(marker);
  if (idx !== -1) {
    source = `${source.slice(0, idx)}${lazyBlock}${source.slice(idx)}`;
    inserted = true;
    break;
  }
}
if (!inserted) {
  source += `\n${lazyBlock}`;
}

// Wrap the main render output in Suspense. Handles the standard current return shape.
source = source.replace(
  /return\s+<Layout\s+page=\{page\}\s+setPage=\{setPage\}>\{renderPage\(\)\}<\/Layout>;/,
  `return (\n    <Layout page={page} setPage={setPage}>\n      <Suspense fallback={<PageLoading />}>{renderPage()}</Suspense>\n    </Layout>\n  );`
);

if (!source.includes('<Suspense fallback={<PageLoading />}')) {
  console.warn('Warning: Could not automatically wrap Layout with Suspense. Please wrap {renderPage()} manually.');
}

source = source
  .replace(/\n{3,}/g, '\n\n')
  .replace(/^\s+$/gm, '');

fs.writeFileSync(appPath, source);

console.log(`Converted ${pageImports.length} page imports to React.lazy().`);
console.log(`Backup created at ${path.relative(process.cwd(), backupPath)}.`);
console.log('Next: run npm run typecheck && npm run build.');
