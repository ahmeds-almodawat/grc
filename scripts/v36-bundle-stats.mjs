import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const distAssets = path.resolve('dist/assets');

function sizeKb(bytes) {
  return `${(bytes / 1024).toFixed(2)} kB`;
}

if (!fs.existsSync(distAssets)) {
  console.error('dist/assets not found. Run npm run build first.');
  process.exit(1);
}

const files = fs.readdirSync(distAssets)
  .filter((file) => file.endsWith('.js') || file.endsWith('.css'))
  .map((file) => {
    const full = path.join(distAssets, file);
    const raw = fs.readFileSync(full);
    return {
      file,
      type: file.endsWith('.js') ? 'js' : 'css',
      bytes: raw.length,
      gzipBytes: zlib.gzipSync(raw).length,
    };
  })
  .sort((a, b) => b.bytes - a.bytes);

const js = files.filter((file) => file.type === 'js');
const css = files.filter((file) => file.type === 'css');
const totalJs = js.reduce((sum, file) => sum + file.bytes, 0);
const totalJsGzip = js.reduce((sum, file) => sum + file.gzipBytes, 0);
const largestJs = js[0];

console.log('\nGRC Control Center v3.6 Bundle Stats');
console.log('====================================');
console.log(`JS chunks: ${js.length}`);
console.log(`CSS files: ${css.length}`);
console.log(`Total JS: ${sizeKb(totalJs)} raw / ${sizeKb(totalJsGzip)} gzip`);
if (largestJs) {
  console.log(`Largest JS chunk: ${largestJs.file} - ${sizeKb(largestJs.bytes)} raw / ${sizeKb(largestJs.gzipBytes)} gzip`);
}
console.log('\nTop assets:');
for (const file of files.slice(0, 12)) {
  console.log(`- ${file.file}: ${sizeKb(file.bytes)} raw / ${sizeKb(file.gzipBytes)} gzip`);
}

const tooLarge = js.filter((file) => file.bytes > 650 * 1024);
if (tooLarge.length) {
  console.log('\nWarning: some JS chunks are still above 650 kB raw:');
  for (const file of tooLarge) console.log(`- ${file.file}: ${sizeKb(file.bytes)}`);
  console.log('Next optimization would be React.lazy route-level dynamic imports.');
} else {
  console.log('\nOK: all JS chunks are below the v3.6 650 kB target.');
}
