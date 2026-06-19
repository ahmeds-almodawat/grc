import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v700');
fs.mkdirSync(outDir, { recursive: true });
const strict = process.argv.includes('--strict');
const applicationSchemas = new Set(['public']);

const bridgePlan = {
  refresh_automation_intelligence: ['keep_server_only', 'Run from scheduled/server automation; the browser should only read refreshed results.'],
  seed_release_factory_defaults: ['remove_from_frontend_seed_release_tool', 'Keep default seeding in an explicit local/release operator tool.'],
  create_board_pack_snapshot: ['convert_to_edge_function', 'Require an authenticated Edge Function that validates board-pack role and tenant scope.'],
  record_backup_schedule_run: ['keep_server_only', 'Backup scheduler state must be written by trusted server automation.'],
  seed_final_release_defaults: ['remove_from_frontend_seed_release_tool', 'Keep release seeding in an explicit operator-only tool.'],
  refresh_escalation_events: ['keep_server_only', 'Refresh escalation events from scheduled/server automation; the browser should query results.'],
  acknowledge_escalation_event: ['convert_to_edge_function', 'Validate tenant, role, and event state in an authenticated Edge Function.'],
  resolve_escalation_event: ['convert_to_edge_function', 'Validate tenant, role, and workflow transition in an authenticated Edge Function.'],
  assign_user_role: ['convert_to_edge_function', 'Enforce organization scope and privilege-escalation protections in an authenticated admin Edge Function.'],
  deactivate_user_role: ['convert_to_edge_function', 'Enforce organization scope and last-admin invariants in an authenticated admin Edge Function.'],
  update_ovr_workflow: ['convert_to_edge_function', 'Apply explicit OVR access, transition, and confidentiality checks in an authenticated Edge Function.'],
  create_ovr_corrective_action_project: ['convert_to_edge_function', 'Verify OVR access and create only tenant-scoped records in an authenticated Edge Function.'],
  create_system_health_snapshot: ['keep_server_only', 'Create snapshots from trusted monitoring automation and expose results read-only.'],
  generate_due_reminders: ['keep_server_only', 'Generate reminders from scheduled/server automation.'],
  seed_v33_production_proof_defaults: ['remove_from_frontend_seed_release_tool', 'Keep proof-data seeding in an explicit operator tool.'],
  seed_v31_finish_fast_defaults: ['remove_from_frontend_seed_release_tool', 'Keep finish-fast defaults in an explicit release operator tool.'],
  start_restore_dry_run: ['keep_server_only', 'Run restore verification only from trusted local/server tooling.'],
  run_ultra_release_preflight: ['keep_server_only', 'Run release preflight from trusted CI/operator tooling and expose the result read-only.'],
  seed_staging_validation_defaults: ['remove_from_frontend_seed_release_tool', 'Keep staging fixture seeding in explicit local staging tooling.'],
  seed_default_qa_test_cases: ['remove_from_frontend_seed_release_tool', 'Keep QA fixture seeding in a test/operator tool.'],
  search_grc_global: ['browser_safe_after_review', 'Keep browser access only while RLS, tenant filtering, and SECURITY INVOKER remain verified.'],
};

const reviewedServiceRoleOnlyLocations = {
  refresh_automation_intelligence: ['src/lib/automationApi.ts', 220],
  seed_release_factory_defaults: ['src/lib/consolidationApi.ts', 119],
  create_board_pack_snapshot: ['src/lib/enterpriseApi.ts', 173],
  record_backup_schedule_run: ['src/lib/enterpriseApi.ts', 202],
  seed_final_release_defaults: ['src/lib/finalizationApi.ts', 155],
  refresh_escalation_events: ['src/lib/grcApi.ts', 370],
  acknowledge_escalation_event: ['src/lib/grcApi.ts', 376],
  resolve_escalation_event: ['src/lib/grcApi.ts', 382],
  assign_user_role: ['src/lib/grcApi.ts', 986],
  deactivate_user_role: ['src/lib/grcApi.ts', 1002],
  update_ovr_workflow: ['src/lib/grcApi.ts', 1226],
  create_ovr_corrective_action_project: ['src/lib/grcApi.ts', 1241],
  create_system_health_snapshot: ['src/lib/hardeningApi.ts', 149],
  generate_due_reminders: ['src/lib/operationsApi.ts', 178],
  seed_v33_production_proof_defaults: ['src/lib/productionProofApi.ts', 106],
  seed_v31_finish_fast_defaults: ['src/lib/productionReadinessApi.ts', 167],
  start_restore_dry_run: ['src/lib/releaseOpsApi.ts', 215],
  run_ultra_release_preflight: ['src/lib/releaseOpsApi.ts', 221],
  seed_staging_validation_defaults: ['src/lib/stabilizationApi.ts', 198],
  seed_default_qa_test_cases: ['src/lib/testingApi.ts', 169],
};

function runNodeScript(script) {
  const scriptPath = path.join(root, 'scripts', script);
  if (!fs.existsSync(scriptPath)) return false;
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  return result.status === 0;
}

const inventoryPath = path.join(outDir, 'frontend-rpc-inventory.json');
runNodeScript('v700-rpc-inventory.mjs');
const inventory = fs.existsSync(inventoryPath)
  ? JSON.parse(fs.readFileSync(inventoryPath, 'utf8'))
  : { calls: [] };

function getDbContainer() {
  try {
    const output = execFileSync('docker', ['ps', '--format', '{{.Names}}'], { encoding: 'utf8' });
    return output.split(/\r?\n/).find((name) => /^supabase_db/.test(name.trim()))?.trim() || null;
  } catch {
    return null;
  }
}

const dbContainer = getDbContainer();
let dbFunctions = [];
let dbQueryStatus = 'not_run_no_supabase_db_container';
let dbQueryError = null;

if (dbContainer) {
  const sql = `
select coalesce(json_agg(row_to_json(function_audit)), '[]'::json)
from (
  select
    n.nspname as schema,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    p.oid::regprocedure::text as function_signature,
    case when p.prosecdef then 'security_definer' else 'security_invoker' end as security_mode,
    has_function_privilege('public', p.oid, 'EXECUTE') as public_execute,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
    has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname not in ('pg_catalog', 'information_schema')
    and n.nspname not like 'pg_toast%'
  order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
) function_audit;
`;
  const result = spawnSync(
    'docker',
    ['exec', '-i', dbContainer, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
  if (result.status === 0) {
    try {
      dbFunctions = JSON.parse(result.stdout.trim() || '[]');
      dbQueryStatus = 'passed';
    } catch (error) {
      dbQueryStatus = 'failed';
      dbQueryError = `Could not parse database audit JSON: ${error.message}`;
    }
  } else {
    dbQueryStatus = 'failed';
    dbQueryError = `${result.stderr || ''}${result.stdout || ''}`.trim();
  }
}

const byName = new Map();
for (const fn of dbFunctions) {
  const matches = byName.get(fn.function_name) || [];
  matches.push(fn);
  byName.set(fn.function_name, matches);
}

const directFrontendCalls = (inventory.calls || []).filter(
  (call) => call.transport !== 'authenticated_edge_bridge',
);
const authenticatedEdgeBridgeCalls = (inventory.calls || []).filter(
  (call) => call.transport === 'authenticated_edge_bridge',
);
const callRisks = [];
for (const call of directFrontendCalls) {
  const matches = byName.get(call.rpc) || [];
  const [recommendedAction = 'unclassified', recommendation = 'Review and assign a least-privilege bridge action.'] =
    bridgePlan[call.rpc] || [];
  if (matches.length === 0) {
    callRisks.push({
      ...call,
      runtime_grant_status: 'not_found_in_database_or_dynamic_rpc',
      current_security_mode: 'not_found',
      current_grant_status: null,
      risk_level: 'review',
      recommended_action: recommendedAction,
      recommendation,
    });
    continue;
  }

  const preferred = matches.find((fn) => fn.schema === 'public') || matches[0];
  const broad = preferred.public_execute || preferred.anon_execute || preferred.authenticated_execute;
  const serviceRoleOnly =
    preferred.service_role_execute
    && !preferred.public_execute
    && !preferred.anon_execute
    && !preferred.authenticated_execute;
  let riskLevel = 'low';
  let runtimeGrantStatus = 'browser_safe_candidate';

  if (preferred.security_mode === 'security_definer' && broad && applicationSchemas.has(preferred.schema)) {
    riskLevel = 'critical';
    runtimeGrantStatus = 'broad_application_security_definer_execute';
  } else if (serviceRoleOnly) {
    riskLevel = recommendedAction === 'unclassified' ? 'critical' : 'high';
    runtimeGrantStatus = 'service_role_only_direct_frontend_risk';
  } else if (!broad) {
    riskLevel = 'medium';
    runtimeGrantStatus = 'not_executable_by_browser_roles';
  }

  callRisks.push({
    ...call,
    schema: preferred.schema,
    function_signature: preferred.function_signature,
    current_security_mode: preferred.security_mode,
    current_grant_status: {
      public: preferred.public_execute,
      anon: preferred.anon_execute,
      authenticated: preferred.authenticated_execute,
      service_role: preferred.service_role_execute,
    },
    runtime_grant_status: runtimeGrantStatus,
    risk_level: riskLevel,
    recommended_action: recommendedAction,
    recommendation,
  });
}

const broadSecurityDefiner = dbFunctions.filter(
  (fn) =>
    fn.security_mode === 'security_definer'
    && (fn.public_execute || fn.anon_execute || fn.authenticated_execute),
);
const applicationBroadSecurityDefiner = broadSecurityDefiner.filter((fn) => applicationSchemas.has(fn.schema));
const managedBroadSecurityDefiner = broadSecurityDefiner
  .filter((fn) => !applicationSchemas.has(fn.schema))
  .map((fn) => ({
    ...fn,
    qualified_function: fn.function_signature.includes('.')
      ? fn.function_signature
      : `${fn.schema}.${fn.function_signature}`,
    broad_grantees: [
      fn.public_execute ? 'public' : null,
      fn.anon_execute ? 'anon' : null,
      fn.authenticated_execute ? 'authenticated' : null,
    ].filter(Boolean),
    disposition: 'Supabase-managed schema observation; do not revoke with an application migration.',
  }));
const serviceRoleOnlyFrontend = callRisks.filter(
  (item) => item.runtime_grant_status === 'service_role_only_direct_frontend_risk',
);
const serviceRoleOnlyWithoutPlan = serviceRoleOnlyFrontend.filter(
  (item) => item.recommended_action === 'unclassified',
);
const critical = callRisks.filter((item) => item.risk_level === 'critical');
const currentCallsByRpc = new Map();
for (const call of directFrontendCalls) {
  const current = currentCallsByRpc.get(call.rpc) || [];
  current.push({ file: call.file, line: call.line });
  currentCallsByRpc.set(call.rpc, current);
}
const edgeBridgeCallsByRpc = new Map();
for (const call of authenticatedEdgeBridgeCalls) {
  const current = edgeBridgeCallsByRpc.get(call.rpc) || [];
  current.push({ file: call.file, line: call.line });
  edgeBridgeCallsByRpc.set(call.rpc, current);
}
const reviewedBridgeCatalog = Object.entries(reviewedServiceRoleOnlyLocations).map(
  ([rpcName, [reviewedFile, reviewedLine]]) => {
    const matches = byName.get(rpcName) || [];
    const preferred = matches.find((fn) => fn.schema === 'public') || matches[0] || null;
    const [recommendedAction, recommendation] = bridgePlan[rpcName];
    const currentLocations = currentCallsByRpc.get(rpcName) || [];
    const edgeBridgeLocations = edgeBridgeCallsByRpc.get(rpcName) || [];
    return {
      rpc_name: rpcName,
      v700_reviewed_frontend_file: reviewedFile,
      v700_reviewed_frontend_line: reviewedLine,
      current_frontend_call_present: currentLocations.length > 0,
      current_frontend_locations: currentLocations,
      authenticated_edge_bridge_present: edgeBridgeLocations.length > 0,
      authenticated_edge_bridge_locations: edgeBridgeLocations,
      current_security_mode: preferred?.security_mode || 'not_found',
      current_grant_status: preferred
        ? {
            public: preferred.public_execute,
            anon: preferred.anon_execute,
            authenticated: preferred.authenticated_execute,
            service_role: preferred.service_role_execute,
          }
        : null,
      recommended_action: recommendedAction,
      recommendation,
      remediation_status:
        currentLocations.length > 0
          ? 'bridge_implementation_pending_with_ui_error_handling'
          : edgeBridgeLocations.length > 0
            ? 'authenticated_edge_function_bridge_present'
          : 'direct_browser_call_removed_or_guarded',
    };
  },
);

const report = {
  generated_at: new Date().toISOString(),
  db_container: dbContainer,
  db_query_status: dbQueryStatus,
  db_query_error: dbQueryError,
  frontend_rpc_total: directFrontendCalls.length,
  authenticated_edge_bridge_call_total: authenticatedEdgeBridgeCalls.length,
  unique_frontend_rpc_total: new Set(directFrontendCalls.map((item) => item.rpc)).size,
  database_function_total: dbFunctions.length,
  database_security_definer_functions: dbFunctions.filter(
    (fn) => fn.security_mode === 'security_definer',
  ).length,
  remaining_broad_security_definer_execute_grants: applicationBroadSecurityDefiner.length,
  managed_schema_broad_security_definer_observations: managedBroadSecurityDefiner.length,
  service_role_only_rpc_called_by_frontend: serviceRoleOnlyFrontend.length,
  service_role_only_rpc_without_bridge_plan: serviceRoleOnlyWithoutPlan.length,
  reviewed_service_role_only_rpc_catalog_count: reviewedBridgeCatalog.length,
  reviewed_rpc_edge_bridged_count: reviewedBridgeCatalog.filter(
    (item) => item.authenticated_edge_bridge_present,
  ).length,
  bridge_artifacts: {
    edge_function: fs.existsSync(path.join(root, 'supabase', 'functions', 'privileged-action', 'index.ts')),
    service_dispatcher_migration: fs.existsSync(
      path.join(root, 'supabase', 'migrations', '047_v72_runtime_bridge_and_persona_security.sql'),
    ),
    real_persona_proof: fs.existsSync(
      path.join(root, 'release', 'v72', 'real-authenticated-persona-proof.json'),
    ),
  },
  critical_runtime_security_findings: critical.length,
  status:
    dbQueryStatus !== 'passed'
      ? 'db_not_available_static_inventory_only'
      : applicationBroadSecurityDefiner.length > 0 || serviceRoleOnlyWithoutPlan.length > 0
        ? 'critical_remediation_required'
        : serviceRoleOnlyFrontend.length > 0
          ? 'documented_bridge_work_remaining'
          : 'passed',
  scope_resolution:
    'Blocking broad-grant scope is the application-owned public schema. Supabase-managed net and supabase_functions functions are printed separately and are not changed by application migrations.',
  application_broad_security_definer_grants: applicationBroadSecurityDefiner,
  managed_schema_broad_security_definer_grants: managedBroadSecurityDefiner,
  reviewed_service_role_only_rpc_catalog: reviewedBridgeCatalog,
  call_risks: callRisks,
};

const exactCalls = serviceRoleOnlyFrontend.map(
  (item) =>
    `- \`${item.rpc}\` - \`${item.file}:${item.line}\` - ${item.current_security_mode} - `
    + `grants=${JSON.stringify(item.current_grant_status)} - **${item.recommended_action}**: ${item.recommendation}`,
).join('\n') || 'None detected.';
const managedFunctions = managedBroadSecurityDefiner.map(
  (item) =>
    `- \`${item.qualified_function}\` - grantees: ${item.broad_grantees.join(', ')} - ${item.disposition}`,
).join('\n') || 'None detected.';
const reviewedCatalogMarkdown = reviewedBridgeCatalog.map(
  (item) =>
    `- \`${item.rpc_name}\` - reviewed at \`${item.v700_reviewed_frontend_file}:${item.v700_reviewed_frontend_line}\` - `
    + `${item.current_security_mode} - grants=${JSON.stringify(item.current_grant_status)} - `
    + `**${item.recommended_action}** - ${item.remediation_status}`,
).join('\n');

fs.writeFileSync(
  path.join(outDir, 'runtime-security-bridge-audit.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(outDir, 'runtime-security-bridge-audit.md'),
  `# v7.1 Runtime Security Bridge Audit

## Result

\`\`\`json
${JSON.stringify({ ...report, call_risks: undefined }, null, 2)}
\`\`\`

## Service-role-only RPCs still called by frontend

${exactCalls}

## Reviewed v7.0 service-role-only RPC catalog

${reviewedCatalogMarkdown}

## Managed-schema broad SECURITY DEFINER observations

${managedFunctions}
`,
);

console.log('v7.1 runtime security bridge audit complete.');
console.log(JSON.stringify({
  status: report.status,
  frontend_rpc_total: report.frontend_rpc_total,
  remaining_broad_security_definer_execute_grants:
    report.remaining_broad_security_definer_execute_grants,
  managed_schema_broad_security_definer_observations:
    report.managed_schema_broad_security_definer_observations,
  service_role_only_rpc_called_by_frontend:
    report.service_role_only_rpc_called_by_frontend,
  service_role_only_rpc_without_bridge_plan:
    report.service_role_only_rpc_without_bridge_plan,
  report: 'release/v700/runtime-security-bridge-audit.json',
}, null, 2));

if (
  strict
  && (
    dbQueryStatus !== 'passed'
    || applicationBroadSecurityDefiner.length > 0
    || serviceRoleOnlyWithoutPlan.length > 0
  )
) {
  process.exit(1);
}
