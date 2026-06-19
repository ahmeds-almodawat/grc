#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const assetsDir = path.resolve('dist/assets');
const warnKb = Number(process.env.BUNDLE_WARN_KB || 500);
const failKb = Number(process.env.BUNDLE_FAIL_KB || 1200);

if (!fs.existsSync(assetsDir)) {
  console.error('dist/assets was not found. Run npm run build first.');
  process.exit(1);
}

const files = fs.readdirSync(assetsDir)
  .filter(file => file.endsWith('.js') || file.endsWith('.css'))
  .map(file => {
    const size = fs.statSync(path.join(assetsDir, file)).size;
    return { file, kb: size / 1024, size };
  })
  .sort((a, b) => b.size - a.size);

const largestJs = files.find(file => file.file.endsWith('.js'));
const jsFiles = files.filter(file => file.file.endsWith('.js'));
const cssFiles = files.filter(file => file.file.endsWith('.css'));

console.log('\nBundle budget summary');
console.log('=====================');
console.log(`JS chunks: ${jsFiles.length}`);
console.log(`CSS files: ${cssFiles.length}`);
console.log(`Largest JS: ${largestJs ? `${largestJs.file} (${largestJs.kb.toFixed(1)} KB)` : 'none'}`);
console.log('\nTop assets:');
for (const item of files.slice(0, 12)) {
  const marker = item.kb > failKb ? 'FAIL' : item.kb > warnKb ? 'WARN' : 'OK';
  console.log(`${marker.padEnd(4)} ${item.kb.toFixed(1).padStart(8)} KB  ${item.file}`);
}

if (largestJs && largestJs.kb > failKb) {
  console.error(`\nLargest JS chunk exceeds hard budget ${failKb} KB.`);
  process.exit(2);
}

if (largestJs && largestJs.kb > warnKb) {
  console.warn(`\nLargest JS chunk is still above warning budget ${warnKb} KB, but below hard fail budget ${failKb} KB.`);
} else {
  console.log('\nBundle budget looks good.');
}
