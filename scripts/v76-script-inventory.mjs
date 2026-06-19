import { readPackageJson, writeJson, writeMd, mdTable } from './v76-common.mjs';

const pkg = readPackageJson();
const scripts = pkg.scripts || {};
const names = Object.keys(scripts).sort();

const categories = {
  canonical: [],
  evidence: [],
  versioned: [],
  test: [],
  ci: [],
  other: [],
};

for (const name of names) {
  if (['dev', 'typecheck', 'build', 'ci:static', 'repo:health', 'pilot:readiness'].includes(name)) categories.canonical.push(name);
  else if (/^v\d+/.test(name)) categories.versioned.push(name);
  else if (name.includes('proof') || name.includes('audit') || name.includes('evidence')) categories.evidence.push(name);
  else if (name.includes('test')) categories.test.push(name);
  else if (name.includes('ci')) categories.ci.push(name);
  else categories.other.push(name);
}

const highScriptCount = names.length > 50;
const result = {
  generated_at: new Date().toISOString(),
  total_scripts: names.length,
  category_counts: Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, v.length])),
  high_script_count_warning: highScriptCount,
  policy: 'Do not delete historical evidence scripts before controlled pilot evidence is closed.',
  scripts: names.map((name) => ({ name, command: scripts[name] })),
};

writeJson('script-inventory.json', result);

const rows = Object.entries(categories).map(([category, list]) => [category, list.length, list.slice(0, 25).join(', ') + (list.length > 25 ? ', ...' : '')]);
const md = `# v7.6 Script Inventory\n\nGenerated: ${result.generated_at}\n\nTotal npm scripts: **${result.total_scripts}**\n\nStatus: **${highScriptCount ? 'large_script_surface_review_required' : 'manageable'}**\n\n${mdTable(['Category', 'Count', 'Examples'], rows)}\n\n## Policy note\n\nHistorical evidence scripts are intentionally preserved. Consolidation should happen only after controlled-pilot evidence is closed.\n`;
writeMd('script-inventory.md', md);
console.log('v7.6 script inventory generated.');
console.log(JSON.stringify({ total_scripts: result.total_scripts, report: 'release/v76/script-inventory.md' }, null, 2));
