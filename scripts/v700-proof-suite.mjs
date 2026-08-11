import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const comprehensiveGroupOrder = Object.freeze([
  'technical',
  'runtime-security',
  'personas',
  'restore',
  'pilot',
]);

export const proofGroups = Object.freeze({
  ci: Object.freeze([
    'v62:static-strict',
    'v64:rls-regression',
    'v64:functions-strict',
    'v64:views-strict',
    'v64:persona-sql',
    'v700:rpc-inventory',
    'v700:v65-audit-strict',
  ]),
  technical: Object.freeze([
    'typecheck',
    'build',
    'v62:static-strict',
    'v64:strict-all',
    'v673:security-definer-audit',
    'v700:v65-audit',
  ]),
  'runtime-security': Object.freeze(['v700:rpc-inventory', 'v700:runtime-security']),
  personas: Object.freeze(['v72:persona-proof', 'v700:persona-gap']),
  restore: Object.freeze(['v674:restore-dryrun', 'v674:signoff-check']),
  pilot: Object.freeze([
    'v672:capture',
    'v662:strict-proof',
    'v661:strict-proof',
    'v66:strict-proof',
    'v663:progress-audit',
  ]),
  'runtime-local': Object.freeze([
    'v673:security-definer-audit',
    'v72:persona-proof',
    'v672:capture',
  ]),
  governance: Object.freeze([
    'v674:signoff-check',
    'v662:strict-proof',
    'v661:strict-proof',
    'v66:strict-proof',
    'v663:progress-audit',
  ]),
});

export const proofCommandContracts = Object.freeze({
  typecheck: { hermetic: true, classification: 'repository-static', proves: 'TypeScript source contract.' },
  build: { hermetic: true, classification: 'repository-static', proves: 'Production bundle compilation.' },
  'v62:static-strict': { hermetic: true, classification: 'repository-static', proves: 'No forbidden production/demo data patterns in committed source.' },
  'v64:rls-regression': { hermetic: true, classification: 'repository-static-with-explicit-git-base', proves: 'No new Critical/High RLS or browser-ACL regression relative to the supplied resolvable base SHA.' },
  'v64:functions-strict': { hermetic: true, classification: 'repository-static', proves: 'Static SECURITY DEFINER search_path and execute-revoke contract.' },
  'v64:views-strict': { hermetic: true, classification: 'repository-static', proves: 'Static sensitive-view security-invoker contract.' },
  'v64:persona-sql': { hermetic: true, classification: 'repository-static', proves: 'Committed persona SQL exists and can be packaged without executing it.' },
  'v700:rpc-inventory': { hermetic: true, classification: 'repository-static', proves: 'Current frontend direct-RPC and authenticated-edge-bridge inventory.' },
  'v700:v65-audit-strict': { hermetic: true, classification: 'repository-static', proves: 'Canonical v65 SQL security assertions and committed copies remain complete and synchronized.' },
  'v64:strict-all': { hermetic: true, classification: 'absolute-release-proof', proves: 'Absolute current-tree RLS/function/view release posture; inherited blockers remain blocking.' },
  'v673:security-definer-audit': { hermetic: false, classification: 'local-runtime-proof', proves: 'Effective PostgreSQL SECURITY DEFINER execute ACLs in a running local Supabase database.' },
  'v700:v65-audit': { hermetic: true, classification: 'repository-static-report', proves: 'Non-strict v65 SQL contract report.' },
  'v700:runtime-security': { hermetic: false, classification: 'local-runtime-or-controlled-inventory-proof', proves: 'Runtime bridge grant posture using a live local catalog or controlled inventory evidence.' },
  'v72:persona-proof': { hermetic: false, classification: 'local-runtime-proof', proves: 'Authenticated persona allow/deny behavior through local Auth, Database, and Edge Runtime.' },
  'v700:persona-gap': { hermetic: false, classification: 'local-runtime-evidence-proof', proves: 'Completeness of previously executed authenticated persona evidence.' },
  'v674:restore-dryrun': { hermetic: false, classification: 'restore-proof', proves: 'Local pg_dump, isolated restore, catalog/count integrity, and smoke checks.' },
  'v674:signoff-check': { hermetic: false, classification: 'manual-governance-evidence-proof', proves: 'Human management, IT, Quality, and confidentiality approvals.' },
  'v672:capture': { hermetic: false, classification: 'local-runtime-proof', proves: 'Local migration, SQL-persona, workflow, and evidence capture against a running database.' },
  'v662:strict-proof': { hermetic: false, classification: 'manual-governance-evidence-proof', proves: 'Controlled evidence-quality register.' },
  'v661:strict-proof': { hermetic: false, classification: 'manual-governance-evidence-proof', proves: 'Staged evidence attachments and go/no-go records.' },
  'v66:strict-proof': { hermetic: false, classification: 'manual-governance-evidence-proof', proves: 'Controlled pilot go/no-go evidence.' },
  'v663:progress-audit': { hermetic: false, classification: 'generated-evidence-consistency-proof', proves: 'Consistency of controlled proof progress artifacts.' },
});

export function resolveProofGroups(mode) {
  if (mode === 'all') return [...comprehensiveGroupOrder];
  if (proofGroups[mode]) return [mode];
  throw new Error(`Unknown proof suite mode: ${mode}`);
}

export function selectedProofCommands(mode) {
  return resolveProofGroups(mode).flatMap((group) => proofGroups[group]);
}

export function runProofSuite({ root = process.cwd(), mode = 'all' } = {}) {
  const outDir = path.join(root, 'release', 'v700');
  fs.mkdirSync(outDir, { recursive: true });
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const scripts = pkg.scripts || {};
  const selectedGroups = resolveProofGroups(mode);
  const results = [];
  const npmRunner = process.platform === 'win32'
    ? { command: 'cmd.exe', argsPrefix: ['/d', '/s', '/c', 'npm'] }
    : { command: 'npm', argsPrefix: [] };

  for (const group of selectedGroups) {
    for (const scriptName of proofGroups[group]) {
      const contract = proofCommandContracts[scriptName] || {
        hermetic: false,
        classification: 'unclassified',
        proves: 'No proof contract documented.',
      };
      if (!scripts[scriptName]) {
        results.push({ group, script: scriptName, status: 'skipped_missing_package_script', contract });
        continue;
      }
      console.log(`\n=== npm run ${scriptName} ===`);
      const result = spawnSync(npmRunner.command, [...npmRunner.argsPrefix, 'run', scriptName], {
        cwd: root,
        stdio: 'inherit',
        shell: false,
        env: process.env,
      });
      results.push({
        group,
        script: scriptName,
        status: result.status === 0 ? 'passed' : 'failed',
        exit_code: result.status,
        contract,
      });
    }
  }

  const failed = results.filter((result) => result.status === 'failed');
  const skipped = results.filter((result) => result.status === 'skipped_missing_package_script');
  const report = {
    generated_at: new Date().toISOString(),
    mode,
    selected_groups: selectedGroups,
    status: failed.length
      ? 'failed_review_required'
      : skipped.length
        ? 'passed_with_skipped_legacy_scripts'
        : 'passed',
    passed_count: results.filter((result) => result.status === 'passed').length,
    failed_count: failed.length,
    skipped_count: skipped.length,
    failed_commands: failed.map((result) => result.script),
    skipped_commands: skipped.map((result) => result.script),
    note: mode === 'ci'
      ? 'Hermetic CI mode executes only clean-checkout repository proofs. Runtime, restore, and human-governance proofs are not claimed.'
      : 'Comprehensive and controlled modes retain their runtime, restore, and governance prerequisites.',
    results,
  };

  fs.writeFileSync(path.join(outDir, `proof-suite-${mode}.json`), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(
    path.join(outDir, `PROOF_SUITE_${mode.toUpperCase().replaceAll('-', '_')}.md`),
    `# v7.0 Proof Suite: ${mode}\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`,
  );
  console.log('\n=== v7.0 proof suite summary ===');
  console.log(JSON.stringify({
    status: report.status,
    passed_count: report.passed_count,
    failed_count: report.failed_count,
    skipped_count: report.skipped_count,
    failed_commands: report.failed_commands,
    report: `release/v700/proof-suite-${mode}.json`,
  }, null, 2));
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const report = runProofSuite({ mode: process.argv[2] || 'all' });
    if (report.failed_count > 0) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
