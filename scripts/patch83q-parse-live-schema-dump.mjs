import fs from 'node:fs';

const dumpPath = process.env.PATCH83Q_LIVE_SCHEMA_DUMP;
if (!dumpPath || !fs.existsSync(dumpPath)) {
  throw new Error('PATCH83Q_LIVE_SCHEMA_DUMP must point to a schema-only Supabase dump.');
}

const sql = fs.readFileSync(dumpPath, 'utf8');
const outputPath = process.env.PATCH83Q_INVENTORY_OUTPUT;
const functions = [];
const createPattern = /^CREATE OR REPLACE FUNCTION "([^"]+)"\."([^"]+)"\((.*?)\) RETURNS /gms;

for (const match of sql.matchAll(createPattern)) {
  const [header, schema, functionName] = match;
  const start = match.index;
  const nextCreate = sql.indexOf('\nCREATE OR REPLACE FUNCTION ', start + header.length);
  const section = sql.slice(start, nextCreate === -1 ? sql.length : nextCreate);
  const alterPattern = new RegExp(
    `^ALTER FUNCTION "${schema.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\."${functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\((.*?)\\) OWNER TO "([^"]+)";`,
    'm',
  );
  const alter = section.match(alterPattern);
  if (!alter || !/\bSECURITY DEFINER\b/i.test(section)) continue;

  const identityArguments = alter[1]
    .split(/,\s*/)
    .filter(Boolean)
    .map((argument) => argument.replace(/^"[^"]+"\s+/, '').replaceAll('"', ''))
    .join(', ');
  const qualifiedSignature = `${schema}.${functionName}(${identityArguments})`;
  const aclNeedle = `FUNCTION "${schema}"."${functionName}"(${alter[1]})`;
  const acl = sql.split(/\r?\n/).filter(
    (line) => /^(GRANT|REVOKE) /.test(line) && line.includes(aclNeedle),
  );
  const publicRevoked = acl.some((line) => line.startsWith('REVOKE ALL ') && line.endsWith(' FROM PUBLIC;'));
  const explicitPublicExecute = acl.some(
    (line) => line.startsWith('GRANT ') && line.endsWith(' TO PUBLIC;'),
  );
  const explicitRoles = new Set(
    acl.flatMap((line) => {
      const role = line.match(/^GRANT (?:ALL|EXECUTE) .* TO "([^"]+)";/)?.[1];
      return role ? [role] : [];
    }),
  );
  const publicExecute = !publicRevoked;
  const roleExecute = (role) => publicExecute || explicitRoles.has(role);
  const language = section.match(/LANGUAGE "([^"]+)"/)?.[1] ?? 'unknown';
  const volatility = /\bIMMUTABLE\b/i.test(section)
    ? 'immutable'
    : /\bSTABLE\b/i.test(section)
      ? 'stable'
      : 'volatile';

  functions.push({
    schema,
    function_name: functionName,
    identity_arguments: identityArguments,
    function_signature: qualifiedSignature,
    owner: alter[2],
    language,
    security_definer: true,
    volatility,
    public_execute: publicExecute,
    explicit_public_execute: explicitPublicExecute,
    public_execute_source: publicExecute
      ? explicitPublicExecute ? 'explicit_grant' : 'implicit_default'
      : 'explicitly_revoked',
    explicit_anon_execute: explicitRoles.has('anon'),
    anon_execute: roleExecute('anon'),
    anon_execute_source: explicitRoles.has('anon')
      ? 'explicit_grant'
      : publicExecute ? 'public_derived' : 'none',
    explicit_authenticated_execute: explicitRoles.has('authenticated'),
    authenticated_execute: roleExecute('authenticated'),
    authenticated_execute_source: explicitRoles.has('authenticated')
      ? 'explicit_grant'
      : publicExecute ? 'public_derived' : 'none',
    explicit_service_role_execute: explicitRoles.has('service_role'),
    service_role_execute: roleExecute('service_role'),
    acl_statements: acl,
  });
}

functions.sort((left, right) => left.function_signature.localeCompare(right.function_signature));
const broad = functions.filter(
  (fn) => fn.public_execute || fn.anon_execute || fn.authenticated_execute,
);
const focusedClassification = {
  'public.create_pilot_go_no_go_review(text, uuid)': {
    final_category: 'confirmed_unsafe_browser_exposure', direct_browser_usage: false, edge_function_usage: true,
    behavior: 'write', scope_enforcement: 'actor id is accepted as input; no organization scope check in function body',
  },
  'public.current_user_org_id()': {
    final_category: 'browser_safe_authenticated_read_only', direct_browser_usage: false, edge_function_usage: false,
    behavior: 'read_only', scope_enforcement: 'auth.uid() lookup; null caller returns null',
  },
  'public.has_any_role(text[])': {
    final_category: 'browser_safe_authenticated_read_only', direct_browser_usage: false, edge_function_usage: false,
    behavior: 'read_only', scope_enforcement: 'auth.uid() lookup; null caller returns false',
  },
  'public.record_executive_production_signoff(uuid, text, text, text)': {
    final_category: 'confirmed_unsafe_browser_exposure', direct_browser_usage: false, edge_function_usage: true,
    behavior: 'privileged_governance_write', scope_enforcement: 'role is looked up by caller-supplied actor id; no auth.uid() equality or organization scope check',
  },
  'public.record_pilot_go_no_go_event(uuid, text, text, uuid)': {
    final_category: 'confirmed_unsafe_browser_exposure', direct_browser_usage: false, edge_function_usage: true,
    behavior: 'governance_write', scope_enforcement: 'actor id is accepted as input; no organization scope check in function body',
  },
  'public.update_pilot_go_no_go_review_status(uuid, text, text, uuid)': {
    final_category: 'confirmed_unsafe_browser_exposure', direct_browser_usage: false, edge_function_usage: true,
    behavior: 'governance_write', scope_enforcement: 'actor id is accepted as input; no organization scope check in function body',
  },
};
for (const fn of functions) {
  Object.assign(fn, focusedClassification[fn.function_signature] || {
    final_category: 'internal_database_only',
    direct_browser_usage: false,
    edge_function_usage: false,
    behavior: 'not_individually_reviewed_no_browser_execute',
    scope_enforcement: 'not_applicable_to_focused_browser-executable_review',
  });
}
const report = {
  source: 'linked_supabase_schema_only_dump',
  supabase_project_ref: 'zbrjjecpsrzposhuarcn',
  contains_table_data: false,
  security_definer_function_count: functions.length,
  broad_security_definer_execute_count: broad.length,
  confirmed_unsafe_browser_exposure_count: broad.filter((fn) => fn.final_category === 'confirmed_unsafe_browser_exposure').length,
  verified_browser_safe_read_only_count: broad.filter((fn) => fn.final_category === 'browser_safe_authenticated_read_only').length,
  managed_schema_observations: [
    { schema: 'graphql', function_name: 'get_schema_version', identity_arguments: '', function_signature: 'graphql.get_schema_version()', owner: 'supabase_admin', language: 'sql', security_definer: true, volatility: 'volatile', public_execute: true, anon_execute: true, authenticated_execute: true, service_role_execute: true, final_category: 'managed_schema_observation' },
    { schema: 'graphql', function_name: 'increment_schema_version', identity_arguments: '', function_signature: 'graphql.increment_schema_version()', owner: 'supabase_admin', language: 'plpgsql', security_definer: true, volatility: 'volatile', public_execute: true, anon_execute: true, authenticated_execute: true, service_role_execute: true, final_category: 'managed_schema_observation' },
    { schema: 'net', function_name: 'http_get', identity_arguments: 'url text, params jsonb, headers jsonb, timeout_milliseconds integer', function_signature: 'net.http_get(text, jsonb, jsonb, integer)', owner: 'supabase_admin', language: 'plpgsql', security_definer: true, volatility: 'volatile', public_execute: false, anon_execute: true, authenticated_execute: true, service_role_execute: true, final_category: 'managed_schema_observation' },
    { schema: 'net', function_name: 'http_post', identity_arguments: 'url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer', function_signature: 'net.http_post(text, jsonb, jsonb, jsonb, integer)', owner: 'supabase_admin', language: 'plpgsql', security_definer: true, volatility: 'volatile', public_execute: false, anon_execute: true, authenticated_execute: true, service_role_execute: true, final_category: 'managed_schema_observation' },
    { schema: 'supabase_functions', function_name: 'http_request', identity_arguments: '', function_signature: 'supabase_functions.http_request()', owner: 'supabase_functions_admin', language: 'plpgsql', security_definer: true, volatility: 'volatile', public_execute: false, anon_execute: true, authenticated_execute: true, service_role_execute: true, final_category: 'managed_schema_observation' },
  ],
  broad_security_definer_functions: broad,
  functions,
};
const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) fs.writeFileSync(outputPath, serialized);
if (process.env.PATCH83Q_QUIET !== '1') process.stdout.write(serialized);
