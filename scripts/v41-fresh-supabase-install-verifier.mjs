import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release');
fs.mkdirSync(releaseDir, { recursive: true });
const migrationDir = path.join(root, 'supabase/migrations');
const sqlFiles = fs.existsSync(migrationDir)
  ? fs.readdirSync(migrationDir).filter((f) => f.endsWith('.sql')).sort()
  : [];
const sqlText = sqlFiles.map((f) => fs.readFileSync(path.join(migrationDir, f), 'utf8')).join('\n\n');

const requiredObjects = [
  'organizations', 'profiles', 'user_roles', 'projects', 'milestones', 'tasks', 'evidence_files', 'approvals',
  'risks', 'risk_controls', 'compliance_items', 'audit_findings', 'ovr_reports', 'v_executive_grc_summary',
  'v_global_search_index', 'v_v34_pilot_wave_summary', 'v_v35_consolidation_scorecard', 'v_v42_rls_persona_matrix'
];

const objectResults = requiredObjects.map((name) => ({
  name,
  found_in_migrations: new RegExp(`\\b${name}\\b`, 'i').test(sqlText),
}));

const env = {
  url: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  anon: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
};

const onlineChecks = [];
if (env.url && env.anon && typeof fetch === 'function') {
  const endpoints = ['organizations', 'projects', 'risks', 'ovr_reports'];
  for (const table of endpoints) {
    try {
      const res = await fetch(`${env.url.replace(/\/$/, '')}/rest/v1/${table}?select=id&limit=1`, {
        headers: { apikey: env.anon, Authorization: `Bearer ${env.anon}` }
      });
      onlineChecks.push({ table, ok: res.ok, status: res.status, status_text: res.statusText });
    } catch (error) {
      onlineChecks.push({ table, ok: false, error: String(error?.message || error) });
    }
  }
}

const missingObjects = objectResults.filter((r) => !r.found_in_migrations).map((r) => r.name);
const duplicatePrefixes = (() => {
  const map = new Map();
  for (const file of sqlFiles) {
    const prefix = file.match(/^(\d{3})/)?.[1];
    if (!prefix) continue;
    const list = map.get(prefix) || [];
    list.push(file);
    map.set(prefix, list);
  }
  return [...map.entries()].filter(([, list]) => list.length > 1).map(([prefix, files]) => ({ prefix, files }));
})();

const status = missingObjects.length || duplicatePrefixes.length ? 'needs_attention' : 'offline_pass';
const report = {
  generated_at: new Date().toISOString(),
  status,
  migration_count: sqlFiles.length,
  latest_migration: sqlFiles.at(-1) || null,
  duplicate_prefixes: duplicatePrefixes,
  object_results: objectResults,
  missing_objects: missingObjects,
  online_mode: Boolean(env.url && env.anon),
  online_checks: onlineChecks,
  instructions: [
    'Create a fresh Supabase staging project.',
    'Apply migrations from supabase/migrations in filename order.',
    'Run seed functions after migrations, especially seed_v42_release_validation_defaults().',
    'Run this verifier again with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY loaded.',
    'Do not proceed to pilot until online checks and RLS persona tests are complete.'
  ]
};
fs.writeFileSync(path.join(releaseDir, 'v41-fresh-supabase-install-verifier.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(releaseDir, 'v41-fresh-supabase-install-verifier.md'), `# v4.1 Fresh Supabase Install Verifier\n\nStatus: **${status}**\n\nMigration count: **${report.migration_count}**\n\nLatest migration: **${report.latest_migration || 'none'}**\n\n## Missing required objects in migration scan\n\n${missingObjects.length ? missingObjects.map((x) => `- ${x}`).join('\n') : 'None'}\n\n## Duplicate migration prefixes\n\n${duplicatePrefixes.length ? duplicatePrefixes.map((x) => `- ${x.prefix}: ${x.files.join(', ')}`).join('\n') : 'None'}\n\n## Online checks\n\n${onlineChecks.length ? onlineChecks.map((x) => `- ${x.table}: ${x.ok ? 'OK' : 'FAILED'} ${x.status || ''} ${x.status_text || x.error || ''}`).join('\n') : 'Not run. Set Supabase env variables to enable basic REST checks.'}\n`);
console.log(`v4.1 Supabase install verifier status: ${status}`);
if (status === 'needs_attention') process.exitCode = 1;
