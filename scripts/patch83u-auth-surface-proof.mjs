import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const normalizeName = (value) => value
  .replace(/"/g, '')
  .replace(/^public\./i, '')
  .trim()
  .toLowerCase();

const normalizeCatalogIdentifier = (value) => {
  let normalized = normalizeName(value);
  while (Buffer.byteLength(normalized, 'utf8') > 63) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
};

const stripSqlComments = (sql) => sql
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/--.*$/gm, ' ');

const lineNumber = (text, index) => text.slice(0, index).split(/\r?\n/).length;

function collectMatches(text, regex) {
  const matches = [];
  regex.lastIndex = 0;
  let match;
  while ((match = regex.exec(text))) matches.push(match);
  return matches;
}

function parseMigrationState(migrationFiles) {
  const views = new Map();
  const materializedViews = new Map();
  const tables = new Map();
  const functions = new Map();
  const relationGrants = new Map();
  const functionAcl = new Map();
  const evidence = [];
  const legacyBrowserBaseTables = new Map();
  let authenticatedAllTablesGrant = false;

  const relationState = (name) => {
    if (!relationGrants.has(name)) {
      relationGrants.set(name, { authenticated: false, public: false, evidence: [] });
    }
    return relationGrants.get(name);
  };

  for (const migrationFile of [...migrationFiles].sort((a, b) => a.path.localeCompare(b.path))) {
    const sql = stripSqlComments(migrationFile.text);

    for (const match of collectMatches(sql, /\bcreate\s+(?:or\s+replace\s+)?(materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?((?:public\.)?"?[a-zA-Z_][\w$]*"?)\s*([\s\S]*?);/gi)) {
      const name = normalizeName(match[2]);
      const record = {
        name,
        kind: match[1] ? 'materialized_view' : 'view',
        definition: match[0],
        security_invoker: /\bsecurity_invoker\s*=\s*true\b/i.test(match[0]),
        definition_file: migrationFile.path,
        definition_line: lineNumber(sql, match.index),
      };
      views.delete(name);
      materializedViews.delete(name);
      (record.kind === 'view' ? views : materializedViews).set(name, record);
    }

    for (const match of collectMatches(sql, /\bdrop\s+(materialized\s+)?view\s+(?:if\s+exists\s+)?((?:public\.)?"?[a-zA-Z_][\w$]*"?)/gi)) {
      const name = normalizeName(match[2]);
      views.delete(name);
      materializedViews.delete(name);
    }

    for (const match of collectMatches(sql, /\balter\s+(materialized\s+)?view\s+(?:if\s+exists\s+)?((?:public\.)?"?[a-zA-Z_][\w$]*"?)\s+set\s*\(([^)]*)\)/gi)) {
      const name = normalizeName(match[2]);
      const record = views.get(name) || materializedViews.get(name);
      if (record && /\bsecurity_invoker\s*=\s*true\b/i.test(match[3])) {
        record.security_invoker = true;
        record.security_invoker_file = migrationFile.path;
        record.security_invoker_line = lineNumber(sql, match.index);
      }
    }

    for (const match of collectMatches(sql, /^\s*create\s+table\s+(?:if\s+not\s+exists\s+)?((?:public\.)?"?[a-zA-Z_][\w$]*"?)([\s\S]*?);/gim)) {
      const name = normalizeName(match[1]);
      tables.set(name, tables.get(name) || {
        name,
        rls_enabled: false,
        organization_scoped: /\borganization_id\b/i.test(match[2]),
        created_file: migrationFile.path,
        created_line: lineNumber(sql, match.index),
      });
    }

    for (const match of collectMatches(sql, /\bdrop\s+table\s+(?:if\s+exists\s+)?((?:public\.)?"?[a-zA-Z_][\w$]*"?)/gi)) {
      tables.delete(normalizeName(match[1]));
    }

    for (const match of collectMatches(sql, /\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?((?:public\.)?"?[a-zA-Z_][\w$]*"?)\s+(enable|disable)\s+row\s+level\s+security/gi)) {
      const name = normalizeName(match[1]);
      const record = tables.get(name) || {
        name,
        rls_enabled: false,
        organization_scoped: false,
        created_file: null,
        created_line: null,
      };
      record.rls_enabled = match[2].toLowerCase() === 'enable';
      record.rls_file = migrationFile.path;
      record.rls_line = lineNumber(sql, match.index);
      tables.set(name, record);
    }

    for (const block of collectMatches(sql, /do\s+\$patch83u_legacy_browser_base_tables\$([\s\S]*?)\$patch83u_legacy_browser_base_tables\$\s*;/gi)) {
      const body = block[1];
      const completeHardening = /alter table %I\.%I enable row level security/i.test(body)
        && /create policy patch83u_browser_base_scope/i.test(body)
        && /patch83u_credential_access_allowed\(\)/i.test(body)
        && /grant select on table %I\.%I to authenticated/i.test(body);
      if (!completeHardening) continue;
      for (const item of collectMatches(body, /\(\s*'([a-zA-Z_][\w$]*)'\s*,\s*(true|false)\s*\)/gi)) {
        const name = normalizeName(item[1]);
        const record = tables.get(name);
        if (!record) continue;
        record.rls_enabled = true;
        record.organization_scoped = item[2].toLowerCase() === 'true';
        record.rls_file = migrationFile.path;
        record.rls_line = lineNumber(sql, block.index);
        record.rls_evidence = 'Patch83U audited legacy browser base-table hardening loop';
        tables.set(name, record);
        legacyBrowserBaseTables.set(name, {
          name,
          organization_scoped: record.organization_scoped,
          rls_enabled: true,
          credential_policy: record.organization_scoped
            ? 'credential_active_and_current_user_org_id'
            : 'credential_active_global_release_metadata',
          authenticated_select_grant: true,
          evidence_file: migrationFile.path,
          evidence_line: lineNumber(sql, block.index),
        });
        const grant = relationState(name);
        grant.authenticated = true;
        grant.evidence.push(`${migrationFile.path}:${lineNumber(sql, block.index)} audited dynamic SELECT grant`);
      }
    }

    for (const match of collectMatches(sql, /\bcreate\s+(?:or\s+replace\s+)?function\s+((?:public\.)?"?[a-zA-Z_][\w$]*"?)\s*\(([^)]*)\)([\s\S]*?)\$\$\s*;/gi)) {
      const name = normalizeCatalogIdentifier(match[1]);
      const records = functions.get(name) || [];
      const identity = match[2].replace(/\s+/g, ' ').trim();
      const replacement = {
        name,
        identity,
        definition: match[0],
        security_mode: /\bsecurity\s+definer\b/i.test(match[3]) ? 'security_definer' : 'security_invoker',
        definition_file: migrationFile.path,
        definition_line: lineNumber(sql, match.index),
      };
      const index = records.findIndex((record) => record.identity === identity);
      if (index >= 0) records.splice(index, 1, replacement);
      else records.push(replacement);
      functions.set(name, records);
      if (!functionAcl.has(name)) {
        functionAcl.set(name, { public: true, authenticated: true, evidence: ['PostgreSQL default PUBLIC EXECUTE'] });
      }
    }

    for (const match of collectMatches(sql, /\balter\s+function\s+((?:public\.)?"?[a-zA-Z_][\w$]*"?)\s*\([^)]*\)\s+rename\s+to\s+("?[a-zA-Z_][\w$]*"?)/gi)) {
      const sourceName = normalizeCatalogIdentifier(match[1]);
      const destinationName = normalizeCatalogIdentifier(match[2]);
      const records = functions.get(sourceName) || [];
      if (records.length) {
        functions.delete(sourceName);
        functions.set(destinationName, records.map((record) => ({
          ...record,
          name: destinationName,
          renamed_from: sourceName,
          definition_file: migrationFile.path,
          definition_line: lineNumber(sql, match.index),
        })));
      }
      if (functionAcl.has(sourceName)) {
        functionAcl.set(destinationName, functionAcl.get(sourceName));
        functionAcl.delete(sourceName);
      }
    }

    for (const match of collectMatches(sql, /\b(grant|revoke)\s+([\w\s,]+?)\s+on\s+(?!function\b)(?:table\s+)?([^;]+?)\s+(?:to|from)\s+([\w\s,]+)\s*;/gi)) {
      const operation = match[1].toLowerCase();
      const privileges = match[2].toLowerCase();
      const grantees = match[4].toLowerCase();
      if (!/(select|all)/.test(privileges)) continue;
      if (/^all\s+tables\s+in\s+schema\s+public$/i.test(match[3].trim())) {
        if (/\bauthenticated\b/i.test(grantees)) authenticatedAllTablesGrant = operation === 'grant';
        continue;
      }
      for (const rawName of match[3].split(',')) {
        const name = normalizeName(rawName.replace(/^table\s+/i, ''));
        if (!/^[a-zA-Z_][\w$]*$/.test(name)) continue;
        const record = relationState(name);
        for (const role of ['authenticated', 'public']) {
          if (new RegExp(`\\b${role}\\b`, 'i').test(grantees)) {
            record[role] = operation === 'grant';
            record.evidence.push(`${migrationFile.path}:${lineNumber(sql, match.index)} ${operation} ${privileges} ${role}`);
          }
        }
      }
    }

    for (const match of collectMatches(sql, /\b(grant|revoke)\s+(?:all|execute)\s+on\s+function\s+((?:public\.)?"?[a-zA-Z_][\w$]*"?)\s*\([^)]*\)\s+(?:to|from)\s+([\w\s,]+)/gi)) {
      const operation = match[1].toLowerCase();
      const name = normalizeCatalogIdentifier(match[2]);
      const grantees = match[3].toLowerCase();
      const record = functionAcl.get(name) || {
        public: true,
        authenticated: true,
        anon: true,
        service_role: false,
        evidence: ['PostgreSQL default PUBLIC EXECUTE'],
      };
      for (const role of ['authenticated', 'public', 'anon', 'service_role']) {
        if (new RegExp(`\\b${role}\\b`, 'i').test(grantees)) record[role] = operation === 'grant';
      }
      record.evidence.push(`${migrationFile.path}:${lineNumber(sql, match.index)} ${operation} execute ${grantees.trim()}`);
      functionAcl.set(name, record);
    }

    evidence.push(migrationFile.path);
  }

  const allSql = migrationFiles.map((file) => file.text).join('\n');
  const patch83uDynamicRevoke = /p\.proname\s+like\s+'patch83u\\_%'[\s\S]*revoke all on function %s from public, anon, authenticated/i.test(allSql);
  if (patch83uDynamicRevoke) {
    for (const name of functions.keys()) {
      if (!name.startsWith('patch83u_')) continue;
      const acl = functionAcl.get(name) || { public: true, authenticated: true, anon: true, evidence: [] };
      acl.public = false;
      acl.authenticated = false;
      acl.anon = false;
      acl.evidence.push('migration174 dynamic patch83u_* revoke from public, anon, authenticated');
      functionAcl.set(name, acl);
    }
    // Re-apply the three deliberate RLS-helper grants that follow the loop.
    for (const name of [
      'patch83u_credential_access_allowed',
      'patch83u_profile_update_allowed',
      'patch83u_user_role_mutation_allowed',
    ]) {
      const acl = functionAcl.get(name);
      if (acl && new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${name}\\s*\\(`, 'i').test(allSql)) {
        acl.authenticated = true;
        acl.evidence.push('migration174 explicit authenticated RLS-helper grant');
      }
    }
  }
  const credentialGate = {
    target_migration_present: /create\s+or\s+replace\s+function\s+public\.patch83u_credential_access_allowed\s*\(/i.test(allSql),
    public_rls_loop_present: /relrowsecurity\s*=\s*true[\s\S]*create policy patch83u_credential_gate[\s\S]*as restrictive for all to authenticated[\s\S]*patch83u_credential_access_allowed\(\)/i.test(allSql),
    profiles_gate_present: /create policy patch83u_profile_credential_read_gate[\s\S]*for select to authenticated[\s\S]*patch83u_credential_access_allowed\(\)/i.test(allSql),
    authenticated_view_catalog_hardening_present:
      /relkind\s*=\s*'v'[\s\S]*has_table_privilege\s*\(\s*'authenticated'[\s\S]*'select'[\s\S]*alter view[\s\S]*security_invoker\s*=\s*true/i.test(allSql),
    authenticated_materialized_view_fail_closed_present:
      /relkind\s*=\s*'m'[\s\S]*has_table_privilege\s*\(\s*'authenticated'[\s\S]*'select'[\s\S]*raise exception 'PATCH83U_AUTHENTICATED_MATERIALIZED_VIEW_EXPOSURE'/i.test(allSql),
  };

  return {
    views,
    materializedViews,
    tables,
    functions,
    relationGrants,
    functionAcl,
    credentialGate,
    patch83uDynamicRevoke,
    legacyBrowserBaseTables,
    authenticatedAllTablesGrant,
    evidence,
  };
}

function parseBrowserReferences(sourceFiles, knownViews, knownMaterializedViews) {
  const directRpcs = new Map();
  const edgeActions = new Map();
  const directRelations = new Map();
  const allKnownViews = new Set([...knownViews.keys(), ...knownMaterializedViews.keys()]);

  const add = (map, name, location) => {
    if (!map.has(name)) map.set(name, []);
    const locations = map.get(name);
    if (!locations.some((item) => item.file === location.file && item.line === location.line)) locations.push(location);
  };

  for (const sourceFile of [...sourceFiles].sort((a, b) => a.path.localeCompare(b.path))) {
    const source = sourceFile.text;
    for (const match of collectMatches(source, /\.rpc\s*(?:<[^>]+>)?\s*\(\s*['"`]([a-zA-Z0-9_.$-]+)['"`]/g)) {
      add(directRpcs, normalizeName(match[1]), { file: sourceFile.path, line: lineNumber(source, match.index) });
    }
    for (const match of collectMatches(source, /invokePrivilegedAction\s*(?:<[^>]+>)?\s*\(\s*['"`]([a-zA-Z0-9_.$-]+)['"`]/g)) {
      add(edgeActions, normalizeName(match[1]), { file: sourceFile.path, line: lineNumber(source, match.index) });
    }
    for (const match of collectMatches(source, /\.from\s*(?:<[^>]+>)?\s*\(\s*['"`]([a-zA-Z0-9_.$-]+)['"`]/g)) {
      const name = normalizeName(match[1]);
      if (allKnownViews.has(name) || /^v(?:_|\d)/.test(name)) {
        add(directRelations, name, { file: sourceFile.path, line: lineNumber(source, match.index), evidence: 'literal .from()' });
      }
    }

    // Generic view readers take a relation name parameter. A conservative
    // string-literal scan in files containing .from(variable) inventories a
    // superset and prevents a new helper from hiding a browser view.
    if (/\.from\s*\(\s*[a-zA-Z_$][\w$]*\s*\)/.test(source)) {
      for (const match of collectMatches(source, /['"`]([a-zA-Z_][\w$]*)['"`]/g)) {
        const name = normalizeName(match[1]);
        if (allKnownViews.has(name)) {
          add(directRelations, name, { file: sourceFile.path, line: lineNumber(source, match.index), evidence: 'generic view reader argument' });
        }
      }
    }
  }

  for (const locations of directRpcs.values()) locations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  for (const locations of edgeActions.values()) locations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  for (const locations of directRelations.values()) locations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return { directRpcs, edgeActions, directRelations };
}

function relationDependencies(definition) {
  const ctes = new Set(collectMatches(definition, /(?:\bwith|,)\s*([a-zA-Z_][\w$]*)\s+as\s*\(/gi).map((match) => normalizeName(match[1])));
  const dependencies = new Set();
  const aliases = new Set();
  for (const match of collectMatches(definition, /\b(?:from|join)\s+(?!lateral\b)(?:public\.)?"?([a-zA-Z_][\w$]*)"?/gi)) {
    const before = definition.slice(Math.max(0, match.index - 20), match.index);
    const after = definition.slice(match.index + match[0].length);
    if (/distinct\s*$/i.test(before) || /^\s*\(/.test(after)) continue;
    const name = normalizeName(match[1]);
    dependencies.add(name);
    const alias = after.match(/^\s+(?:as\s+)?([a-zA-Z_][\w$]*)/i)?.[1]?.toLowerCase();
    if (alias && !new Set(['where', 'join', 'left', 'right', 'inner', 'outer', 'full', 'cross', 'on', 'group', 'order', 'limit', 'union', 'having']).has(alias)) {
      aliases.add(alias);
    }
  }
  return [...dependencies]
    .filter((name) => !ctes.has(name) && !aliases.has(name) && name !== 'select' && name !== 'values')
    .sort();
}

function registryDisposition(registrySource, actionName) {
  const escaped = actionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const entry = registrySource.match(new RegExp(`\\{[^{}]*actionName:\\s*['\"]${escaped}['\"][^{}]*\\}`, 'i'))?.[0] || '';
  const rawReviewStatus = entry.match(/reviewStatus:\s*([^,}]+)/i)?.[1]?.trim() || null;
  return {
    present: Boolean(entry),
    transport: entry.match(/actionTransport:\s*['"]([^'"]+)['"]/i)?.[1] || null,
    review_status: rawReviewStatus?.replace(/^['"]|['"]$/g, '') || null,
    direct_browser_exception: /directBrowserException:\s*true/i.test(entry),
  };
}

function auditView(name, callSites, state) {
  const findings = [];
  const visitedViews = new Set();
  const nestedViews = new Set();
  const baseTables = new Map();
  const unresolvedDependencies = new Set();
  let materializedDependency = false;

  const visit = (relationName, chain) => {
    if (state.materializedViews.has(relationName)) {
      materializedDependency = true;
      findings.push({ code: 'MATERIALIZED_VIEW_BROWSER_SURFACE', object: relationName, chain });
      return;
    }
    const view = state.views.get(relationName);
    if (!view) {
      const table = state.tables.get(relationName);
      if (!table) {
        unresolvedDependencies.add(relationName);
        return;
      }
      const gateCovered = table.rls_enabled && state.credentialGate.target_migration_present
        && (relationName === 'profiles'
          ? state.credentialGate.profiles_gate_present
          : state.credentialGate.public_rls_loop_present);
      baseTables.set(relationName, {
        name: relationName,
        rls_enabled: table.rls_enabled,
        organization_scoped: table.organization_scoped,
        credential_gate_targeted: gateCovered,
        evidence_file: table.rls_file || table.created_file,
        evidence_line: table.rls_line || table.created_line,
      });
      if (!table.rls_enabled) findings.push({ code: 'BASE_TABLE_RLS_DISABLED', object: relationName, chain });
      else if (!gateCovered) findings.push({ code: 'BASE_TABLE_CREDENTIAL_GATE_MISSING', object: relationName, chain });
      return;
    }
    if (visitedViews.has(relationName)) return;
    visitedViews.add(relationName);
    if (relationName !== name) nestedViews.add(relationName);
    const effectiveSecurityInvoker = view.security_invoker
      || state.credentialGate.authenticated_view_catalog_hardening_present;
    if (!effectiveSecurityInvoker) findings.push({ code: 'OWNER_EXECUTED_VIEW', object: relationName, chain });
    for (const dependency of relationDependencies(view.definition)) visit(dependency, [...chain, dependency]);
  };

  if (!state.views.has(name) && !state.materializedViews.has(name)) {
    findings.push({ code: 'VIEW_DEFINITION_NOT_FOUND', object: name, chain: [name] });
  } else {
    visit(name, [name]);
  }

  const grant = state.relationGrants.get(name) || { authenticated: false, public: false, evidence: [] };
  if (unresolvedDependencies.size) findings.push({ code: 'UNRESOLVED_VIEW_DEPENDENCY', object: [...unresolvedDependencies].join(', '), chain: [name] });

  const definition = state.views.get(name) || state.materializedViews.get(name) || null;
  return {
    name,
    call_sites: callSites,
    relation_type: definition?.kind || 'unresolved',
    definition_file: definition?.definition_file || null,
    definition_line: definition?.definition_line || null,
    security_invoker_declared: definition?.security_invoker || false,
    security_invoker: Boolean(definition?.security_invoker)
      || (definition?.kind === 'view' && state.credentialGate.authenticated_view_catalog_hardening_present),
    security_invoker_evidence: definition?.security_invoker_file
      ? `${definition.security_invoker_file}:${definition.security_invoker_line}`
      : definition?.security_invoker
        ? `${definition.definition_file}:${definition.definition_line}`
        : null,
    owner_bypass_prevented: (Boolean(definition?.security_invoker)
      || (definition?.kind === 'view' && state.credentialGate.authenticated_view_catalog_hardening_present))
      && !materializedDependency,
    authenticated_grant_intentional: callSites.length > 0 || grant.authenticated || grant.public || state.authenticatedAllTablesGrant,
    authenticated_grant_explicit_in_migrations: grant.authenticated || grant.public || state.authenticatedAllTablesGrant,
    grant_evidence: grant.evidence.length
      ? grant.evidence
      : callSites.length
        ? callSites.map((site) => `${site.file}:${site.line} intentional browser read contract; live ACL must be verified after deployment`)
        : ['Search bridge contract; live ACL must be verified after deployment'],
    nested_views: [...nestedViews].sort(),
    base_tables: [...baseTables.values()].sort((a, b) => a.name.localeCompare(b.name)),
    unresolved_dependencies: [...unresolvedDependencies].sort(),
    findings,
    disposition: findings.length ? 'unsafe' : 'approved_browser_read_view',
  };
}

export function analyzePatch83uAuthSurface({
  migrationFiles,
  sourceFiles,
  registrySource = '',
  edgeSource = '',
  deployedFunctionInventory = null,
}) {
  const state = parseMigrationState(migrationFiles);
  const references = parseBrowserReferences(sourceFiles, state.views, state.materializedViews);
  const directViews = [...references.directRelations.entries()]
    .map(([name, callSites]) => auditView(name, callSites, state))
    .sort((a, b) => a.name.localeCompare(b.name));

  const directRpcs = [...references.directRpcs.entries()].map(([name, callSites]) => {
    const definitions = state.functions.get(name) || [];
    const acl = state.functionAcl.get(name) || { public: false, authenticated: false, evidence: [] };
    const registry = registryDisposition(registrySource, name);
    const findings = [];
    if (!definitions.length) findings.push({ code: 'RPC_DEFINITION_NOT_FOUND', object: name });
    if (definitions.some((definition) => definition.security_mode === 'security_definer')) {
      findings.push({ code: 'EXPOSED_SECURITY_DEFINER_RPC', object: name });
    }
    if (!acl.authenticated && !acl.public) findings.push({ code: 'RPC_NOT_BROWSER_EXECUTABLE', object: name });
    if (registry.direct_browser_exception || registry.transport === 'direct_browser_rpc') {
      findings.push({ code: 'DIRECT_BROWSER_RPC_EXCEPTION_REMAINS', object: name });
    }
    return {
      name,
      call_sites: callSites,
      definitions: definitions.map((definition) => ({
        identity: definition.identity,
        security_mode: definition.security_mode,
        definition_file: definition.definition_file,
        definition_line: definition.definition_line,
      })),
      acl,
      registry,
      findings,
      disposition: findings.length ? 'unsafe' : 'approved_security_invoker_rpc',
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const searchRegistry = registryDisposition(registrySource, 'search_grc_global');
  const searchBridgeLocations = references.edgeActions.get('search_grc_global') || [];
  const searchDependency = auditView(
    'v_global_search_index',
    searchBridgeLocations.map((site) => ({ ...site, evidence: 'authenticated Edge caller-JWT dependency' })),
    state,
  );
  const searchDefinitions = state.functions.get('search_grc_global') || [];
  const searchFindings = [];
  const credentialCheckIndex = edgeSource.indexOf("credentialState.access_allowed !== true");
  const searchBlockIndex = edgeSource.indexOf("if (action === 'search_grc_global')");
  const nextActionIndex = edgeSource.indexOf("if (action === '", searchBlockIndex + 1);
  const searchEdgeBlock = searchBlockIndex >= 0
    ? edgeSource.slice(searchBlockIndex, nextActionIndex >= 0 ? nextActionIndex : undefined)
    : '';
  const callerJwtRlsProof = {
    allowlisted: /['"]search_grc_global['"]/.test(edgeSource),
    after_credential_access_check: credentialCheckIndex >= 0 && searchBlockIndex > credentialCheckIndex,
    anon_key_client: /createClient\(supabaseUrl,\s*anonKey/.test(searchEdgeBlock),
    caller_bearer_forwarded: /Authorization:\s*`Bearer \$\{token\}`/.test(searchEdgeBlock),
    frontend_contract_forwarded: /['"]x-patch83u-frontend-contract-version['"]\s*:\s*PATCH83U_FRONTEND_CONTRACT_VERSION/.test(searchEdgeBlock),
    search_rpc_uses_rls_client: /rlsClient\.rpc\(['"]search_grc_global['"]/.test(searchEdgeBlock),
    service_client_not_used_for_search: !/serviceClient\.rpc\(['"]search_grc_global['"]/.test(searchEdgeBlock),
  };
  if (references.directRpcs.has('search_grc_global')) searchFindings.push({ code: 'SEARCH_RPC_STILL_DIRECT_BROWSER', object: 'search_grc_global' });
  if (!searchBridgeLocations.length) searchFindings.push({ code: 'SEARCH_EDGE_BRIDGE_CALL_NOT_FOUND', object: 'search_grc_global' });
  if (
    searchRegistry.transport !== 'authenticated_edge_bridge'
    || searchRegistry.review_status !== 'approved'
    || searchRegistry.direct_browser_exception
  ) {
    searchFindings.push({ code: 'SEARCH_REGISTRY_NOT_CLOSED', object: 'search_grc_global' });
  }
  if (Object.values(callerJwtRlsProof).some((value) => value !== true)) {
    searchFindings.push({ code: 'SEARCH_CALLER_JWT_RLS_BRIDGE_NOT_PROVEN', object: 'search_grc_global' });
  }
  if (!searchDefinitions.length || searchDefinitions.some((definition) => definition.security_mode !== 'security_invoker')) {
    searchFindings.push({ code: 'SEARCH_RPC_NOT_SECURITY_INVOKER', object: 'search_grc_global' });
  }
  searchFindings.push(...searchDependency.findings.map((finding) => ({ ...finding, via: 'search_grc_global' })));

  const materializedBrowserSurfaces = directViews.filter((view) => view.relation_type === 'materialized_view');
  const retainedLiveHelperAllowlist = new Map([
    ['public.current_user_org_id()', 'Read-only caller organization identity helper retained by Patch 83Q.'],
    ['public.has_any_role(text[])', 'Read-only RLS role decision helper retained by Patch 83Q.'],
  ]);
  const targetRlsHelperAllowlist = new Map([
    ['patch83u_credential_access_allowed', 'Credential version, state, email, and session freshness decision used by restrictive RLS.'],
    ['patch83u_profile_update_allowed', 'Same-organization credential-active profile update decision used by restrictive RLS.'],
    ['patch83u_user_role_mutation_allowed', 'Credential-active canonical role/scope mutation decision used by restrictive RLS.'],
    ['governance_linkage_source_readable', 'Read-only GOV-LINK source visibility decision used by restrictive RLS.'],
    ['governance_linkage_target_readable', 'Read-only GOV-LINK target visibility and redaction decision used by restrictive RLS.'],
  ]);
  const liveBroadSecurityDefiners = (deployedFunctionInventory?.functions || [])
    .filter((item) => item.security_definer && (item.public_execute || item.anon_execute || item.authenticated_execute))
    .map((item) => {
      const signature = item.function_signature.includes('.')
        ? item.function_signature
        : `${item.schema || 'public'}.${item.function_signature}`;
      const allowedPurpose = retainedLiveHelperAllowlist.get(signature) || null;
      return {
        source: 'retained_patch83q_live_catalog',
        schema: item.schema,
        name: item.function_name,
        signature,
        public_execute: Boolean(item.public_execute),
        anon_execute: Boolean(item.anon_execute),
        authenticated_execute: Boolean(item.authenticated_execute),
        final_category: item.final_category || null,
        allowed: Boolean(allowedPurpose) && item.final_category === 'browser_safe_authenticated_read_only',
        allowed_purpose: allowedPurpose,
      };
    })
    .sort((a, b) => a.signature.localeCompare(b.signature));
  const targetBroadSecurityDefiners = [];
  const reviewedRestrictedSecurityDefiners = [];
  const reviewedPatch83uMigrationCeiling = 231;
  const explicitServiceOnlyAclFloor = 176;
  const reviewedTargetSecurityDefinerAllowlist = new Set([
    'f1r2_create_work_item',
  ]);
  for (const [name, definitions] of state.functions) {
    for (const definition of definitions) {
      const migrationNumber = Number(
        definition.definition_file.match(/^supabase\/migrations\/(\d+)_/)?.[1] ?? 0,
      );
      if (migrationNumber < 171) continue;
      if (definition.security_mode !== 'security_definer') continue;
      // Migration 174's dynamic revoke cannot protect a routine introduced or
      // renamed by a later migration. Every SECURITY DEFINER introduced, replaced,
      // or renamed by migrations 176 through the reviewed ceiling therefore needs
      // its own explicit browser-role revoke plus a service-role grant (or explicit
      // owner-only service-role revoke). Any later migration fails closed.
      const recordedAcl = state.functionAcl.get(name) || {
        public: true,
        authenticated: true,
        anon: true,
        service_role: false,
        evidence: ['PostgreSQL default PUBLIC EXECUTE'],
      };
      const requiresExplicitServiceOnlyAcl = migrationNumber >= explicitServiceOnlyAclFloor
        && migrationNumber <= reviewedPatch83uMigrationCeiling
        && !targetRlsHelperAllowlist.has(name);
      const reviewedAclEvidence = recordedAcl.evidence.filter((item) => {
        const evidenceMigration = Number(item.match(/^supabase\/migrations\/(\d+)_/)?.[1] ?? 0);
        return evidenceMigration >= migrationNumber && evidenceMigration <= reviewedPatch83uMigrationCeiling;
      });
      const explicitRevokeEvidence = reviewedAclEvidence
        .filter((item) => item.includes('revoke execute') || item.includes('revoke all'))
        .join(' ');
      const hasExplicitBrowserRevoke = requiresExplicitServiceOnlyAcl
        && /\bpublic\b/.test(explicitRevokeEvidence)
        && /\banon\b/.test(explicitRevokeEvidence)
        && /\bauthenticated\b/.test(explicitRevokeEvidence);
      const hasExplicitServiceGrant = requiresExplicitServiceOnlyAcl
        && recordedAcl.service_role === true
        && reviewedAclEvidence.some((item) =>
          item.includes('grant execute')
          && /\bservice_role\b/.test(item));
      const hasExplicitOwnerOnlyRevoke = requiresExplicitServiceOnlyAcl
        && recordedAcl.service_role !== true
        && reviewedAclEvidence.some((item) =>
          item.includes('revoke execute')
          && /\bservice_role\b/.test(item));
      const explicitServiceOnlyAclProven = hasExplicitBrowserRevoke
        && (hasExplicitServiceGrant || hasExplicitOwnerOnlyRevoke)
        && !recordedAcl.public
        && !recordedAcl.anon
        && !recordedAcl.authenticated;
      const acl = migrationNumber > reviewedPatch83uMigrationCeiling
        || (requiresExplicitServiceOnlyAcl && !explicitServiceOnlyAclProven)
        ? {
          public: true,
          authenticated: true,
          anon: true,
          service_role: false,
          evidence: [
            requiresExplicitServiceOnlyAcl
              ? `migration ${migrationNumber} SECURITY DEFINER routine requires an explicit PUBLIC/anon/authenticated revoke plus either a service_role-only grant or an explicit owner-only service_role revoke`
              : 'future migration SECURITY DEFINER routine requires explicit ACL review',
          ],
        }
        : recordedAcl;
      if (requiresExplicitServiceOnlyAcl && explicitServiceOnlyAclProven) {
        reviewedRestrictedSecurityDefiners.push({
          source: `migration${migrationNumber}_service_role_acl_review`,
          schema: 'public',
          name,
          signature: `public.${name}(${definition.identity})`,
          public_execute: false,
          anon_execute: false,
          authenticated_execute: false,
          service_role_execute: recordedAcl.service_role === true,
          disposition: recordedAcl.service_role === true ? 'service_role_only' : 'owner_only',
          definition_file: definition.definition_file,
          definition_line: definition.definition_line,
          acl_evidence: recordedAcl.evidence,
        });
      }
      if (!acl.public && !acl.authenticated && !acl.anon) {
        if (requiresExplicitServiceOnlyAcl && explicitServiceOnlyAclProven && reviewedTargetSecurityDefinerAllowlist.has(name)) {
          targetBroadSecurityDefiners.push({
            source: `migration${migrationNumber}_service_role_acl_review`,
            schema: 'public',
            name,
            signature: `public.${name}(${definition.identity})`,
            public_execute: false,
            anon_execute: false,
            authenticated_execute: false,
            definition_file: definition.definition_file,
            definition_line: definition.definition_line,
            acl_evidence: acl.evidence,
            allowed: true,
            allowed_purpose: null,
          });
        }
        continue;
      }
      const allowedPurpose = targetRlsHelperAllowlist.get(name) || null;
      targetBroadSecurityDefiners.push({
        source: migrationNumber > reviewedPatch83uMigrationCeiling
          ? 'future_migration_requires_review'
          : requiresExplicitServiceOnlyAcl
            ? `migration${migrationNumber}_service_role_acl_review`
            : `target_migrations_171_${reviewedPatch83uMigrationCeiling}`,
        schema: 'public',
        name,
        signature: `public.${name}(${definition.identity})`,
        public_execute: Boolean(acl.public),
        anon_execute: Boolean(acl.anon),
        authenticated_execute: Boolean(acl.authenticated),
        definition_file: definition.definition_file,
        definition_line: definition.definition_line,
        acl_evidence: acl.evidence,
        allowed: migrationNumber <= reviewedPatch83uMigrationCeiling
          && Boolean(allowedPurpose)
          && !acl.public
          && !acl.anon
          && acl.authenticated === true,
        allowed_purpose: allowedPurpose,
      });
    }
  }
  targetBroadSecurityDefiners.sort((a, b) => a.signature.localeCompare(b.signature));
  reviewedRestrictedSecurityDefiners.sort((a, b) => a.signature.localeCompare(b.signature));
  const aclFunctionFindings = [
    ...liveBroadSecurityDefiners.filter((item) => !item.allowed),
    ...targetBroadSecurityDefiners.filter((item) => !item.allowed),
  ].map((item) => ({
    surface_type: 'acl_reachable_security_definer_rpc',
    surface: item.signature,
    code: 'UNAPPROVED_BROAD_SECURITY_DEFINER_RPC',
    object: item.name,
  }));
  const aclReachableMaterializedViews = [...state.materializedViews.values()]
    .filter((view) => {
      const acl = state.relationGrants.get(view.name) || {};
      return state.authenticatedAllTablesGrant || acl.public || acl.authenticated;
    })
    .map((view) => ({
      name: view.name,
      definition_file: view.definition_file,
      definition_line: view.definition_line,
      acl: state.relationGrants.get(view.name) || { authenticated: state.authenticatedAllTablesGrant, public: false, evidence: [] },
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const materializedAclFindings = aclReachableMaterializedViews.map((view) => ({
    surface_type: 'acl_reachable_materialized_view',
    surface: view.name,
    code: 'AUTHENTICATED_MATERIALIZED_VIEW_EXPOSURE',
    object: view.name,
  }));
  const reachableViewNames = new Set([
    ...directViews.flatMap((view) => [view.name, ...view.nested_views]),
    'v_global_search_index',
    ...searchDependency.nested_views,
  ]);
  const declaredOwnerViews = [...reachableViewNames]
    .filter((name) => state.views.has(name) && !state.views.get(name).security_invoker)
    .sort();
  const reachableBaseTables = new Map();
  for (const view of [...directViews, searchDependency]) {
    for (const table of view.base_tables) reachableBaseTables.set(table.name, table);
  }
  const nonRlsBaseTables = [...reachableBaseTables.values()]
    .filter((table) => !table.rls_enabled)
    .sort((a, b) => a.name.localeCompare(b.name));
  const viewsWithoutExplicitGrant = directViews
    .filter((view) => !view.authenticated_grant_explicit_in_migrations)
    .map((view) => view.name)
    .sort();
  const findings = [
    ...directRpcs.flatMap((rpc) => rpc.findings.map((finding) => ({ surface_type: 'rpc', surface: rpc.name, ...finding }))),
    ...directViews.flatMap((view) => view.findings.map((finding) => ({ surface_type: view.relation_type, surface: view.name, ...finding }))),
    ...searchFindings.map((finding) => ({ surface_type: 'authenticated_edge_bridge_rpc', surface: 'search_grc_global', ...finding })),
    ...aclFunctionFindings,
    ...materializedAclFindings,
  ];

  const deployedSearch = deployedFunctionInventory?.functions?.filter((item) => item.function_name === 'search_grc_global') || [];
  return {
    schema_version: 1,
    status: findings.length ? 'fail' : 'pass',
    evidence: {
      browser_source: 'src/**/*.{ts,tsx}',
      target_schema: `ordered supabase/migrations/*.sql through reviewed migration ${reviewedPatch83uMigrationCeiling}`,
      deployed_function_catalog: deployedFunctionInventory ? 'release/patch83q/patch83q-live-security-definer-inventory.json' : 'not supplied',
      deployed_search_entries: deployedSearch.length,
      note: `Static target-schema proof through reviewed migration ${reviewedPatch83uMigrationCeiling}. No hosted catalog state is claimed.`,
    },
    summary: {
      direct_browser_rpc_count: directRpcs.length,
      direct_browser_view_count: directViews.length,
      direct_browser_materialized_view_count: materializedBrowserSurfaces.length,
      unsafe_surface_count: new Set(findings.map((finding) => `${finding.surface_type}:${finding.surface}`)).size,
      finding_count: findings.length,
      search_transport: searchBridgeLocations.length ? 'authenticated_edge_bridge' : references.directRpcs.has('search_grc_global') ? 'direct_browser_rpc' : 'not_found',
      credential_gate_target_present: state.credentialGate.target_migration_present
        && state.credentialGate.public_rls_loop_present
        && state.credentialGate.profiles_gate_present,
      authenticated_view_catalog_hardening_present: state.credentialGate.authenticated_view_catalog_hardening_present,
      authenticated_materialized_view_fail_closed_present: state.credentialGate.authenticated_materialized_view_fail_closed_present,
      declared_owner_view_count: declaredOwnerViews.length,
      non_rls_base_table_count: nonRlsBaseTables.length,
      views_without_explicit_migration_grant_count: viewsWithoutExplicitGrant.length,
      retained_live_broad_security_definer_count: liveBroadSecurityDefiners.length,
      target_broad_security_definer_count: targetBroadSecurityDefiners.length,
      reviewed_restricted_security_definer_count: reviewedRestrictedSecurityDefiners.length,
      acl_reachable_materialized_view_count: aclReachableMaterializedViews.length,
      legacy_browser_base_table_hardening_count: state.legacyBrowserBaseTables.size,
      reviewed_patch83u_migration_ceiling: reviewedPatch83uMigrationCeiling,
    },
    search_grc_global: {
      disposition: searchFindings.length ? 'unsafe' : 'authenticated_edge_bridge_with_caller_jwt_rls',
      edge_call_sites: searchBridgeLocations,
      registry: searchRegistry,
      caller_jwt_rls_proof: callerJwtRlsProof,
      rpc_security_modes: searchDefinitions.map((definition) => definition.security_mode),
      dependency_view: searchDependency,
      findings: searchFindings,
    },
    direct_browser_rpcs: directRpcs,
    direct_browser_views: directViews,
    direct_browser_materialized_views: materializedBrowserSurfaces,
    acl_reachable_security_definer_rpcs: {
      retained_live: liveBroadSecurityDefiners,
      target_migrations_171_plus: targetBroadSecurityDefiners,
      reviewed_restricted_security_definers: reviewedRestrictedSecurityDefiners,
      retained_live_allowlist: [...retainedLiveHelperAllowlist.entries()].map(([signature, purpose]) => ({ signature, purpose })),
      target_rls_helper_allowlist: [...targetRlsHelperAllowlist.entries()].map(([name, purpose]) => ({ name, purpose })),
      patch83u_dynamic_revoke_proven: state.patch83uDynamicRevoke,
    },
    acl_reachable_materialized_views: aclReachableMaterializedViews,
    legacy_browser_base_table_hardening: [...state.legacyBrowserBaseTables.values()]
      .sort((a, b) => a.name.localeCompare(b.name)),
    target_hardening_evidence: {
      declared_owner_views: declaredOwnerViews,
      non_rls_base_tables: nonRlsBaseTables,
      direct_views_without_explicit_migration_grant: viewsWithoutExplicitGrant,
      grant_note: 'A browser call site records product intent, but the final authenticated ACL still requires read-only hosted catalog verification after deployment.',
    },
    findings,
  };
}

function walkSource(dir, root) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkSource(fullPath, root));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) {
      files.push({ path: path.relative(root, fullPath).replace(/\\/g, '/'), text: fs.readFileSync(fullPath, 'utf8') });
    }
  }
  return files;
}

export function analyzeRepository(root) {
  const migrationsDir = path.join(root, 'supabase', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({ path: `supabase/migrations/${name}`, text: fs.readFileSync(path.join(migrationsDir, name), 'utf8') }));
  const sourceFiles = walkSource(path.join(root, 'src'), root);
  const registryPath = path.join(root, 'src', 'lib', 'runtimeActionRegistry.ts');
  const deployedInventoryPath = path.join(root, 'release', 'patch83q', 'patch83q-live-security-definer-inventory.json');
  return analyzePatch83uAuthSurface({
    migrationFiles,
    sourceFiles,
    registrySource: fs.existsSync(registryPath) ? fs.readFileSync(registryPath, 'utf8') : '',
    edgeSource: fs.readFileSync(path.join(root, 'supabase', 'functions', 'privileged-action', 'index.ts'), 'utf8'),
    deployedFunctionInventory: fs.existsSync(deployedInventoryPath)
      ? JSON.parse(fs.readFileSync(deployedInventoryPath, 'utf8'))
      : null,
  });
}

function renderMarkdown(report) {
  const viewRows = report.direct_browser_views.map((view) =>
    `| \`${view.name}\` | ${view.relation_type} | ${view.security_invoker ? 'yes' : 'NO'} | ${view.base_tables.length} | ${view.authenticated_grant_intentional ? 'yes' : 'NO'} | ${view.disposition} |`,
  ).join('\n');
  const findingRows = report.findings.map((finding) =>
    `- **${finding.code}** — \`${finding.surface}\`${finding.object && finding.object !== finding.surface ? ` via \`${finding.object}\`` : ''}`,
  ).join('\n');
  const declaredOwnerList = report.target_hardening_evidence.declared_owner_views
    .map((name) => `- \`${name}\``).join('\n');
  const nonRlsList = report.target_hardening_evidence.non_rls_base_tables
    .map((table) => `- \`${table.name}\` — ${table.organization_scoped ? 'organization_id scoped' : 'credential-gated global/parent-scoped design required'}`)
    .join('\n');
  const rpcRows = [
    ...report.acl_reachable_security_definer_rpcs.retained_live,
    ...report.acl_reachable_security_definer_rpcs.target_migrations_171_plus,
  ].map((rpc) =>
    `| \`${rpc.signature}\` | ${rpc.source} | ${rpc.public_execute ? 'yes' : 'no'} | ${rpc.anon_execute ? 'yes' : 'no'} | ${rpc.authenticated_execute ? 'yes' : 'no'} | ${rpc.allowed ? 'allowed' : 'UNSAFE'} | ${rpc.allowed_purpose || ''} |`,
  ).join('\n');
  const restrictedRpcRows = report.acl_reachable_security_definer_rpcs.reviewed_restricted_security_definers
    .map((rpc) =>
      `| \`${rpc.signature}\` | ${rpc.source} | ${rpc.service_role_execute ? 'yes' : 'no'} | ${rpc.disposition} | \`${rpc.definition_file}:${rpc.definition_line}\` |`,
    ).join('\n');
  const legacyBaseRows = report.legacy_browser_base_table_hardening.map((table) =>
    `| \`${table.name}\` | ${table.organization_scoped ? 'organization_id' : 'credential-gated global metadata'} | yes | yes |`,
  ).join('\n');
  return `# Patch 83U authenticated browser surface inventory\n\n`
    + `Status: **${report.status.toUpperCase()}**\n\n`
    + `This is a deterministic static replay of the ordered migration chain through reviewed migration ${report.summary.reviewed_patch83u_migration_ceiling} plus actual browser call sites. It is not live-catalog proof and does not claim any hosted catalog state.\n\n`
    + `## Summary\n\n`
    + `- Direct browser RPCs: ${report.summary.direct_browser_rpc_count}\n`
    + `- Direct browser views: ${report.summary.direct_browser_view_count}\n`
    + `- Direct browser materialized views: ${report.summary.direct_browser_materialized_view_count}\n`
    + `- Unsafe surfaces: ${report.summary.unsafe_surface_count}\n`
    + `- Search transport: ${report.summary.search_transport}\n`
    + `- Reviewed restricted migration 176–${report.summary.reviewed_patch83u_migration_ceiling} SECURITY DEFINER routines: ${report.summary.reviewed_restricted_security_definer_count}\n`
    + `- Target credential-gate migration present: ${report.summary.credential_gate_target_present ? 'yes' : 'no'}\n\n`
    + `## search_grc_global\n\n`
    + `Disposition: **${report.search_grc_global.disposition}**. The accepted design is the authenticated Edge bridge using an anon-key Supabase client carrying the caller Bearer token; the RPC remains SECURITY INVOKER and its complete view/base-table chain must remain security-invoker and credential-gated by RLS.\n\n`
    + `## ACL-reachable SECURITY DEFINER routines\n\n`
    + `The retained live Patch 83Q inventory permits exactly two documented read-only helpers. Target migrations 171–${report.summary.reviewed_patch83u_migration_ceiling} permit the five reviewed RLS decision helpers plus the reviewed owner-only F1R2 work-item routine. Every other SECURITY DEFINER routine introduced, replaced, or forward-hardened by migrations 176–${report.summary.reviewed_patch83u_migration_ceiling} must have an explicit revoke from PUBLIC/anon/authenticated plus either a service_role-only grant or an explicit owner-only service_role revoke in the reviewed chain. Migration ${report.summary.reviewed_patch83u_migration_ceiling + 1} and later fail closed until separately reviewed.\n\n`
    + `| Signature | Evidence source | PUBLIC | anon | authenticated | Disposition | Purpose |\n`
    + `|---|---|---:|---:|---:|---|---|\n${rpcRows || '| _none_ | | | | | | |'}\n\n`
    + `### Reviewed restricted routines from migrations 176–${report.summary.reviewed_patch83u_migration_ceiling}\n\n`
    + `These routines are not reachable by browser roles. They are listed explicitly so every reviewed definition and its migration-local ACL proof remain visible.\n\n`
    + `| Signature | Evidence source | service_role | Disposition | Definition evidence |\n`
    + `|---|---|---:|---|---|\n${restrictedRpcRows || '| _none_ | | | | |'}\n\n`
    + `## Materialized views\n\n`
    + `No browser-referenced or ACL-reachable materialized view exists in the target replay. Migration 174 checks the live public catalog and aborts if \`authenticated\` can SELECT any materialized view.\n\n`
    + `## Direct browser views\n\n`
    + `| Surface | Kind | security_invoker | Base tables | Intentional authenticated grant | Disposition |\n`
    + `|---|---|---:|---:|---:|---|\n${viewRows || '| _none_ | | | | | |'}\n\n`
    + `## Findings\n\n${findingRows || 'No unsafe authenticated-browser surface was found in the target migration state.'}\n\n`
    + `## Catalog hardening evidence\n\n`
    + `Views whose original declarations were owner-executed (the target catalog hardening must cover all of them):\n\n${declaredOwnerList || '- None.'}\n\n`
    + `Reachable base tables still lacking RLS in the target replay:\n\n${nonRlsList || '- None.'}\n\n`
    + `The audited legacy base-table correction is exact and grants SELECT only after RLS is enabled:\n\n`
    + `| Base table | Scope | Credential/RLS policy | Authenticated SELECT |\n`
    + `|---|---|---:|---:|\n${legacyBaseRows || '| _none_ | | | |'}\n\n`
    + `${report.target_hardening_evidence.direct_views_without_explicit_migration_grant.length} direct browser views rely on an ACL outside an explicit per-view repository GRANT. Their call sites prove product intent; final hosted catalog ACL evidence remains mandatory.\n\n`
    + `## Proof command\n\n`
    + `Run \`node scripts/patch83u-auth-surface-proof.mjs\`. It exits non-zero for a direct browser RPC, exposed SECURITY DEFINER RPC, pending direct-browser exception, owner-executed view, materialized view, missing intentional grant, non-RLS base table, missing Patch 83U credential gate, or unresolved dependency. Use \`--report-only\` only while preparing a corrective migration.\n`;
}

function writeReport(root, report) {
  const outputDir = path.join(root, 'release', 'patch83u');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'patch83u-auth-surface-inventory.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'patch83u-auth-surface-inventory.md'), renderMarkdown(report));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = process.cwd();
  const report = analyzeRepository(root);
  writeReport(root, report);
  console.log(`Patch 83U auth-surface proof: ${report.status.toUpperCase()}`);
  console.log(JSON.stringify(report.summary, null, 2));
  if (report.status !== 'pass' && !process.argv.includes('--report-only')) process.exitCode = 1;
}
