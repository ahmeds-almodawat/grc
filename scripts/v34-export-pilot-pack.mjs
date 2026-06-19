#!/usr/bin/env node
import fs from 'fs';
fs.mkdirSync('release', { recursive: true });
const pack = {
  generatedAt: new Date().toISOString(),
  version: 'v3.4',
  purpose: 'Pilot operations and real data readiness package',
  requiredProof: [
    'Fresh Supabase migration run 001-030',
    'RLS persona proof',
    'OVR end-to-end proof',
    'Backup/export/restore dry-run proof',
    'Arabic/RTL critical screen acceptance',
    'Pilot sign-off by owner'
  ]
};
fs.writeFileSync('release/v34-pilot-pack-manifest.json', JSON.stringify(pack, null, 2));
console.log('Generated release/v34-pilot-pack-manifest.json');
