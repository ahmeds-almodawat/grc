import fs from 'node:fs';
import path from 'node:path';

const reportDir = path.resolve('release', 'v50-reports');
fs.mkdirSync(reportDir, { recursive: true });

function exists(p) { return fs.existsSync(path.resolve(p)); }
function listFiles(dir, ext) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(ext)).map((f) => path.join(dir, f));
}

const distAssets = exists('dist/assets') ? fs.readdirSync('dist/assets') : [];
const jsAssets = distAssets.filter((f) => f.endsWith('.js'));
const cssAssets = distAssets.filter((f) => f.endsWith('.css'));
const largestJs = jsAssets.map((f) => ({ file: f, bytes: fs.statSync(path.join('dist/assets', f)).size })).sort((a,b)=>b.bytes-a.bytes)[0] || null;
const srcPages = listFiles('src/pages', '.tsx').length;
const srcLib = listFiles('src/lib', '.ts').length;

const report = {
  generated_at: new Date().toISOString(),
  build_detected: exists('dist'),
  js_asset_count: jsAssets.length,
  css_asset_count: cssAssets.length,
  largest_js_asset: largestJs,
  src_pages_count: srcPages,
  src_lib_count: srcLib,
  recommendations: [
    'Keep route-level lazy loading enabled.',
    'Paginate large Supabase lists by default.',
    'Load detail data only when a row/modal is opened.',
    'Use dashboard summary views instead of loading raw tables.',
    'Avoid exporting full datasets from UI without explicit confirmation.'
  ]
};

fs.writeFileSync(path.join(reportDir, 'v50-performance-audit.json'), JSON.stringify(report, null, 2));
console.log('v5.0 performance audit complete.');
console.log(JSON.stringify(report, null, 2));
