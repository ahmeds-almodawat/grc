#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(path.relative(root, full));
  }
}
walk(root);
const inventory = {
  version: 'v3.5',
  generated_at: new Date().toISOString(),
  file_count: files.length,
  files: files.sort(),
};
fs.mkdirSync(path.join(root, 'release'), { recursive: true });
fs.writeFileSync(path.join(root, 'release', 'v35-package-inventory.json'), JSON.stringify(inventory, null, 2));
console.log(`Inventory generated: ${inventory.file_count} files`);
