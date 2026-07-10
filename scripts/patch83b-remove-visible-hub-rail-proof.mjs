import fs from 'fs';
import path from 'path';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const tabbedHub = fs.readFileSync('src/components/TabbedHub.tsx', 'utf8');
assert(tabbedHub.includes('hideTabRail?: boolean'), 'TabbedHub must support hideTabRail prop');
assert(tabbedHub.includes('{hideTabRail ? ('), 'TabbedHub must conditionally render the rail');

const app = fs.readFileSync('src/App.tsx', 'utf8');
assert(app.match(/<TabbedHub hideTabRail/g)?.length >= 8, 'App.tsx must pass hideTabRail to top-level hubs');

// Assert that arrays weren't deleted
assert(app.includes('MyWorkCenter'), 'App.tsx must contain MyWorkCenter');
assert(app.includes('ClinicalGovernanceCenter'), 'App.tsx must contain ClinicalGovernanceCenter');
assert(app.includes('HospitalGovernanceCenter'), 'App.tsx must contain HospitalGovernanceCenter');
assert(app.includes('OvrRiskIndicators'), 'App.tsx must contain OvrRiskIndicators');
assert(app.includes('RelationshipMap'), 'App.tsx must contain RelationshipMap');
assert(app.includes('ExecutiveTruthCenter'), 'App.tsx must contain ExecutiveTruthCenter');
assert(app.includes('AdvancedReportBuilder'), 'App.tsx must contain AdvancedReportBuilder');
assert(app.includes('CustomReports'), 'App.tsx must contain CustomReports');
assert(app.includes('UserManagementCenter'), 'App.tsx must contain UserManagementCenter');
assert(app.includes('HospitalMasterDataCenter'), 'App.tsx must contain HospitalMasterDataCenter');
assert(app.includes('AccessControl'), 'App.tsx must contain AccessControl');
assert(app.includes('SetupCenter'), 'App.tsx must contain SetupCenter');

console.log('✅ Patch 83B proof passed. Visible in-page hub navigation removed without deleting content arrays.');
