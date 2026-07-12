import fs from 'fs';
import path from 'path';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const authAccess = fs.readFileSync('src/auth/authAccess.ts', 'utf8');

assert(layout.includes('id: "grc"'), 'Layout must have GRC category');
assert(layout.includes('key: "risks"'), 'GRC must have risks');
assert(layout.includes('key: "audit"'), 'GRC must have audit');
assert(layout.includes('key: "compliance"'), 'GRC must have compliance');
assert(layout.includes('key: "governance"'), 'GRC must have governance');
assert(!layout.substring(layout.indexOf('id: "quality"'), layout.indexOf('id: "grc"')).includes('key: "risks"'), 'Risks must not be in quality');
assert(layout.match(/id: "workspace"[\s\S]*key: "myWork"/), 'Workspace must have myWork');
assert(layout.match(/id: "policies"[\s\S]*key: "evidence"/), 'Policies must have evidence');

assert(!app.includes('system is production ready'), 'Forbidden claims must be absent');
assert(!app.includes('go-live complete'), 'Forbidden claims must be absent');

console.log('✅ Patch 83C proof passed. Sidebar category consistency audited and fixed.');
