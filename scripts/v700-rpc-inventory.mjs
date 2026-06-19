import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const outDir = path.join(root, 'release', 'v700');
fs.mkdirSync(outDir, { recursive: true });

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', '.git', 'release'].includes(entry.name)) out.push(...walk(full));
    } else if (/\.(tsx?|jsx?)$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function lineNo(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function classifyRpc(name, file) {
  const hay = `${name || ''} ${file}`.toLowerCase();
  if (/backup|restore|release|migration|admin|role|user_role|access|security|export|retention|lock|change_request|cutover/.test(hay)) {
    return 'privileged_admin_review';
  }
  if (/ovr|approval|approve|evidence|project|task|milestone|workflow|quality|finding|escalation|comment/.test(hay)) {
    return 'workflow_runtime_review';
  }
  if (/report|analytics|kpi|dashboard|scorecard|briefing/.test(hay)) {
    return 'reporting_read_candidate';
  }
  return 'unknown_requires_review';
}

const files = walk(srcDir);
const calls = [];
const patterns = [
  {
    transport: 'direct_browser_rpc',
    rx: /\.rpc\s*(?:<[^>]+>)?\s*\(\s*['"`]([A-Za-z0-9_.$-]+)['"`]/g,
  },
  {
    transport: 'direct_browser_rpc',
    rx: /rpc\s*(?:<[^>]+>)?\s*\(\s*['"`]([A-Za-z0-9_.$-]+)['"`]/g,
  },
  {
    transport: 'authenticated_edge_bridge',
    rx: /invokePrivilegedAction\s*(?:<[^>]+>)?\s*\(\s*['"`]([A-Za-z0-9_.$-]+)['"`]/g,
  },
];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const seenAt = new Set();
  for (const pattern of patterns) {
    const rx = pattern.rx;
    let m;
    while ((m = rx.exec(text))) {
      const functionName = m[1];
      const line = lineNo(text, m.index);
      const key = `${rel}:${line}:${functionName}`;
      if (seenAt.has(key)) continue;
      seenAt.add(key);
      calls.push({
        file: rel,
        line,
        rpc: functionName,
        transport: pattern.transport,
        classification: classifyRpc(functionName, rel),
        note: pattern.transport === 'authenticated_edge_bridge'
          ? 'Authenticated Edge Function bridge call; verify the service-only dispatcher and real persona proof.'
          : 'Direct frontend RPC inventory; runtime authorization must be confirmed with DB grants and authenticated workflow tests.'
      });
    }
  }
}

const byRpc = new Map();
for (const call of calls) {
  if (!byRpc.has(call.rpc)) byRpc.set(call.rpc, []);
  byRpc.get(call.rpc).push({
    file: call.file,
    line: call.line,
    transport: call.transport,
    classification: call.classification,
  });
}

const summary = {
  generated_at: new Date().toISOString(),
  source: 'src/**/*.{ts,tsx,js,jsx}',
  frontend_rpc_call_count: calls.filter(
    (call) => call.transport === 'direct_browser_rpc',
  ).length,
  authenticated_edge_bridge_call_count: calls.filter(
    (call) => call.transport === 'authenticated_edge_bridge',
  ).length,
  unique_frontend_rpc_count: byRpc.size,
  classification_counts: calls.reduce((acc, c) => {
    acc[c.classification] = (acc[c.classification] || 0) + 1;
    return acc;
  }, {}),
  unique_rpcs: [...byRpc.entries()].map(([rpc, locations]) => ({ rpc, locations }))
};

fs.writeFileSync(path.join(outDir, 'frontend-rpc-inventory.json'), JSON.stringify({ summary, calls }, null, 2) + '\n');
fs.writeFileSync(
  path.join(outDir, 'frontend-rpc-inventory.csv'),
  ['rpc,file,line,transport,classification', ...calls.map(c => [c.rpc, c.file, c.line, c.transport, c.classification].map(v => `"${String(v).replaceAll('"', '""')}"`).join(','))].join('\n') + '\n'
);
fs.writeFileSync(
  path.join(outDir, 'FRONTEND_RPC_INVENTORY.md'),
  `# v7.0 Frontend RPC Inventory\n\n` +
  `Generated: ${summary.generated_at}\n\n` +
  `- Direct frontend RPC calls: ${summary.frontend_rpc_call_count}\n` +
  `- Authenticated Edge bridge calls: ${summary.authenticated_edge_bridge_call_count}\n` +
  `- Unique RPC names: ${summary.unique_frontend_rpc_count}\n\n` +
  `## Classification counts\n\n\`\`\`json\n${JSON.stringify(summary.classification_counts, null, 2)}\n\`\`\`\n\n` +
  `## Unique RPCs\n\n` +
  summary.unique_rpcs.map(x => `- \`${x.rpc}\` (${x.locations.length} call site${x.locations.length === 1 ? '' : 's'})`).join('\n') + '\n'
);

console.log('v7.0 frontend RPC inventory complete.');
console.log(JSON.stringify(summary, null, 2));
