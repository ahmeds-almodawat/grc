import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const outDir = path.join(root, 'release/patch45');
const outPath = path.join(outDir, 'patch45-workflow-proof.json');
const inventoryScript = path.join(root, 'scripts/v700-rpc-inventory.mjs');
const inventoryPath = path.join(root, 'release/v700/frontend-rpc-inventory.json');
const registryPath = path.join(root, 'src/lib/runtimeActionRegistry.ts');

const inventoryRun = spawnSync(process.execPath, [inventoryScript], { cwd: root, encoding: 'utf8' });
const inventory = fs.existsSync(inventoryPath) ? JSON.parse(fs.readFileSync(inventoryPath, 'utf8')) : { summary: { unique_rpcs: [] }, calls: [] };
const registryText = fs.existsSync(registryPath) ? fs.readFileSync(registryPath, 'utf8') : '';

function registryEntries() {
  const entries = new Map();
  const rx = /\{\s*actionName:\s*'([^']+)'[\s\S]*?actionTransport:\s*'([^']+)'[\s\S]*?moduleName:\s*'([^']+)'[\s\S]*?classification:\s*'([^']+)'[\s\S]*?riskLevel:\s*'([^']+)'[\s\S]*?requiredAccessLevel:\s*'([^']*)'[\s\S]*?ownerRole:\s*'([^']*)'[\s\S]*?reviewStatus:\s*([^,\n]+)[\s\S]*?directBrowserException:\s*(true|false)/g;
  let match;
  while ((match = rx.exec(registryText))) {
    entries.set(match[1], {
      actionTransport: match[2],
      moduleName: match[3],
      classification: match[4],
      riskLevel: match[5],
      requiredAccessLevel: match[6],
      ownerRole: match[7],
      reviewStatus: match[8].includes('pending') ? 'pending_review' : match[8].replaceAll("'", '').trim(),
      directBrowserException: match[9] === 'true',
    });
  }
  return entries;
}

const registry = registryEntries();
const uniqueRpcs = inventory.summary.unique_rpcs ?? [];
const missing = uniqueRpcs.filter(item => !registry.has(item.rpc)).map(item => item.rpc);
const directCalls = (inventory.calls ?? []).filter(call => call.transport === 'direct_browser_rpc');
const directUntracked = directCalls.filter(call => !registry.get(call.rpc)?.directBrowserException).map(call => call.rpc);
const privilegedMissingOwner = [...registry.entries()]
  .filter(([, entry]) => ['privileged_admin', 'user_management'].includes(entry.classification) || ['critical', 'high'].includes(entry.riskLevel))
  .filter(([, entry]) => !entry.ownerRole || !entry.requiredAccessLevel)
  .map(([name]) => name);
const unknown = [...registry.entries()].filter(([, entry]) => entry.classification === 'unknown_requires_review').map(([name]) => name);
const pending = [...registry.entries()].filter(([, entry]) => entry.reviewStatus === 'pending_review').map(([name]) => name);

const checks = [
  { name: 'v700 inventory script runs', passed: inventoryRun.status === 0 },
  { name: 'runtimeActionRegistry exists', passed: fs.existsSync(registryPath) },
  { name: 'every v700 runtime action is represented', passed: missing.length === 0, details: missing },
  { name: 'direct browser RPC exceptions are explicitly tracked', passed: directUntracked.length === 0 && directCalls.some(call => call.rpc === 'search_grc_global'), details: directUntracked },
  { name: 'privileged/high-risk actions have owner and access level', passed: privilegedMissingOwner.length === 0, details: privilegedMissingOwner },
  { name: 'registry intentionally tracks pending reviews', passed: pending.length > 0 },
  { name: 'unknown classifications reduced through registry evidence', passed: unknown.length === 0, details: unknown },
  { name: 'v700 inventory uses registry classifications', passed: !Object.keys(inventory.summary.classification_counts ?? {}).includes('unknown_requires_review') },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '45',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  inventory_unique_runtime_actions: uniqueRpcs.length,
  registry_action_count: registry.size,
  classified_action_count: registry.size - unknown.length,
  unknown_action_count: unknown.length,
  pending_review_count: pending.length,
  direct_browser_rpc_exceptions: directCalls.map(call => call.rpc),
  failed_count: failed.length,
  failed,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
