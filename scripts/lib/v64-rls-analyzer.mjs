import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const BROWSER_ROLES = Object.freeze(['public', 'anon', 'authenticated']);
export const TRACKED_ROLES = Object.freeze([...BROWSER_ROLES, 'service_role']);
export const TABLE_PRIVILEGES = Object.freeze([
  'select',
  'insert',
  'update',
  'delete',
  'truncate',
  'references',
  'trigger',
]);

export function normalizeTableName(raw) {
  return String(raw || '')
    .replace(/if\s+not\s+exists\s+/i, '')
    .replace(/"/g, '')
    .trim()
    .replace(/^public\./i, '')
    .toLowerCase();
}

export function isSensitiveTable(name) {
  return /(ovr|evidence|audit|role|user|profile|approval|export|backup|restore|release|security|rls|incident|patient|department|organization|task|project|risk|compliance|control|policy|finding|notification)/i.test(name);
}

export function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ');
}

function emptyRoleAcl() {
  return {
    explicit_all_revoked: false,
    revoked_privileges: new Set(),
    granted_privileges: new Set(),
    evidence: [],
  };
}

function emptyTableState(table, createdIn) {
  return {
    table,
    created_in: createdIn,
    sensitive: isSensitiveTable(table),
    rls_enabled: false,
    rls_forced: false,
    policies: new Set(),
    acl: new Map(TRACKED_ROLES.map((role) => [role, emptyRoleAcl()])),
    acl_ambiguities: [],
    last_rls_enable_order: null,
    last_force_rls_order: null,
    complete_acl_lockdowns: [],
  };
}

function parseNameList(raw) {
  return String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeRole(raw) {
  return String(raw || '')
    .replace(/"/g, '')
    .replace(/\s+(?:cascade|restrict)\s*$/i, '')
    .trim()
    .toLowerCase();
}

function normalizePrivileges(raw) {
  const text = String(raw || '').trim().toLowerCase();
  if (/^all(?:\s+privileges)?$/.test(text)) return { all: true, privileges: [...TABLE_PRIVILEGES] };
  const privileges = parseNameList(text).map((value) => value.replace(/\s*\([^)]*\)\s*$/, '').trim());
  const valid = privileges.length > 0 && privileges.every((value) => TABLE_PRIVILEGES.includes(value));
  return { all: false, privileges, valid };
}

// Split only top-level SQL statements. Semicolons inside quoted strings and
// dollar-quoted function/DO bodies are deliberately ignored so dynamic SQL is
// never mistaken for an effective top-level ACL statement.
export function splitTopLevelSqlStatements(sql) {
  const statements = [];
  let start = 0;
  let singleQuoted = false;
  let doubleQuoted = false;
  let lineComment = false;
  let blockComment = false;
  let dollarTag = null;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, index)) {
        index += dollarTag.length - 1;
        dollarTag = null;
      }
      continue;
    }
    if (singleQuoted) {
      if (char === "'" && next === "'") {
        index += 1;
      } else if (char === "'") {
        singleQuoted = false;
      }
      continue;
    }
    if (doubleQuoted) {
      if (char === '"' && next === '"') {
        index += 1;
      } else if (char === '"') {
        doubleQuoted = false;
      }
      continue;
    }

    if (char === '-' && next === '-') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'") {
      singleQuoted = true;
      continue;
    }
    if (char === '"') {
      doubleQuoted = true;
      continue;
    }
    if (char === '$') {
      const tag = sql.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
      if (tag) {
        dollarTag = tag;
        index += tag.length - 1;
        continue;
      }
    }
    if (char === ';') {
      const text = sql.slice(start, index).trim();
      if (text) statements.push({ text, index: start });
      start = index + 1;
    }
  }

  const tail = sql.slice(start).trim();
  if (tail) statements.push({ text: tail, index: start });
  return statements;
}

function parseAclStatement(statement) {
  const match = statement.text.match(
    /^\s*(grant|revoke)\s+([\s\S]+?)\s+on\s+(?:(table)\s+)?([\s\S]+?)\s+(to|from)\s+([\s\S]+?)\s*$/i,
  );
  if (!match) return null;

  const action = match[1].toLowerCase();
  const direction = match[5].toLowerCase();
  if ((action === 'grant' && direction !== 'to') || (action === 'revoke' && direction !== 'from')) {
    return { ambiguous: true, reason: 'acl_direction_mismatch', index: statement.index };
  }

  const privilegeState = normalizePrivileges(match[2]);
  const explicitTableKeyword = Boolean(match[3]);
  const rawTargets = parseNameList(match[4]);
  if (!explicitTableKeyword && rawTargets.some((target) => /\(|\)|\b(?:function|sequence|schema)\b/i.test(target))) {
    return null;
  }
  if (!privilegeState.all && privilegeState.valid !== true) {
    return { ambiguous: true, reason: 'unsupported_table_privilege_list', index: statement.index };
  }

  const roles = parseNameList(match[6]).map(normalizeRole);
  const targets = rawTargets
    .map(normalizeTableName)
    .filter((target) => /^[a-z_][a-z0-9_]*$/.test(target));
  if (targets.length !== rawTargets.length || roles.length === 0) {
    return { ambiguous: true, reason: 'unparseable_acl_target_or_role', index: statement.index };
  }

  return {
    action,
    all: privilegeState.all,
    privileges: privilegeState.privileges,
    roles,
    targets,
    index: statement.index,
  };
}

function collectFileEvents(file, fileIndex) {
  const sql = stripSqlComments(file.text);
  const events = [];
  const addMatches = (regex, build) => {
    for (const match of sql.matchAll(regex)) events.push({ fileIndex, index: match.index, ...build(match) });
  };

  addMatches(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?((?:public\.)?[a-zA-Z_][\w]*|"[^"]+")/gi,
    (match) => ({ type: 'create_table', table: normalizeTableName(match[1]) }),
  );
  addMatches(
    /alter\s+table\s+(?:if\s+exists\s+)?((?:public\.)?[a-zA-Z_][\w]*|"[^"]+")\s+enable\s+row\s+level\s+security/gi,
    (match) => ({ type: 'enable_rls', table: normalizeTableName(match[1]) }),
  );
  addMatches(
    /alter\s+table\s+(?:if\s+exists\s+)?((?:public\.)?[a-zA-Z_][\w]*|"[^"]+")\s+disable\s+row\s+level\s+security/gi,
    (match) => ({ type: 'disable_rls', table: normalizeTableName(match[1]) }),
  );
  addMatches(
    /alter\s+table\s+(?:if\s+exists\s+)?((?:public\.)?[a-zA-Z_][\w]*|"[^"]+")\s+force\s+row\s+level\s+security/gi,
    (match) => ({ type: 'force_rls', table: normalizeTableName(match[1]) }),
  );
  addMatches(
    /alter\s+table\s+(?:if\s+exists\s+)?((?:public\.)?[a-zA-Z_][\w]*|"[^"]+")\s+no\s+force\s+row\s+level\s+security/gi,
    (match) => ({ type: 'no_force_rls', table: normalizeTableName(match[1]) }),
  );
  addMatches(
    /create\s+policy\s+(?:if\s+not\s+exists\s+)?("[^"]+"|[a-zA-Z_][\w]*)\s+on\s+((?:public\.)?[a-zA-Z_][\w]*|"[^"]+")/gi,
    (match) => ({
      type: 'create_policy',
      policy: match[1].replace(/"/g, '').toLowerCase(),
      table: normalizeTableName(match[2]),
    }),
  );
  addMatches(
    /drop\s+policy\s+(?:if\s+exists\s+)?("[^"]+"|[a-zA-Z_][\w]*)\s+on\s+((?:public\.)?[a-zA-Z_][\w]*|"[^"]+")/gi,
    (match) => ({
      type: 'drop_policy',
      policy: match[1].replace(/"/g, '').toLowerCase(),
      table: normalizeTableName(match[2]),
    }),
  );

  for (const statement of splitTopLevelSqlStatements(file.text)) {
    const acl = parseAclStatement(statement);
    if (acl) events.push({ fileIndex, type: acl.ambiguous ? 'ambiguous_acl' : 'acl', ...acl });
  }

  return events.map((event) => ({ ...event, migration: file.path }));
}

function roleAclReport(roleState) {
  const explicitlyRevoked = roleState.explicit_all_revoked
    || TABLE_PRIVILEGES.every((privilege) => roleState.revoked_privileges.has(privilege));
  return {
    explicitly_revoked: explicitlyRevoked,
    explicit_all_revoked: roleState.explicit_all_revoked,
    granted_privileges: [...roleState.granted_privileges].sort(),
    revoked_privileges: [...roleState.revoked_privileges].sort(),
    evidence: roleState.evidence,
  };
}

function aclStateSignature(table) {
  return JSON.stringify({
    rls_enabled: table.rls_enabled,
    rls_forced: table.rls_forced,
    policies: [...table.policies].sort(),
    browser_acl: Object.fromEntries(BROWSER_ROLES.map((role) => [role, roleAclReport(table.acl.get(role))])),
    complete_acl_lockdowns: table.complete_acl_lockdowns,
    ambiguities: table.acl_ambiguities,
  });
}

function blockerIdentity(finding) {
  return JSON.stringify([
    finding.severity,
    finding.code,
    finding.table,
    finding.created_in,
    finding.acl_state_signature || null,
  ]);
}

export function analyzeMigrationFiles(migrationFiles) {
  const files = [...migrationFiles].sort((a, b) => a.path.localeCompare(b.path));
  const tables = new Map();
  const events = files.flatMap((file, fileIndex) => collectFileEvents(file, fileIndex));

  for (const event of events.filter((item) => item.type === 'create_table')) {
    if (!tables.has(event.table)) tables.set(event.table, emptyTableState(event.table, event.migration));
  }

  events.sort((a, b) => a.fileIndex - b.fileIndex || a.index - b.index);
  for (const [order, event] of events.entries()) {
    if (event.type === 'ambiguous_acl') continue;
    const targetNames = event.type === 'acl' ? event.targets : [event.table];
    for (const tableName of targetNames) {
      const table = tables.get(tableName);
      if (!table) continue;
      if (event.type === 'enable_rls') {
        table.rls_enabled = true;
        table.last_rls_enable_order = order;
      }
      if (event.type === 'disable_rls') table.rls_enabled = false;
      if (event.type === 'force_rls') {
        table.rls_forced = true;
        table.last_force_rls_order = order;
      }
      if (event.type === 'no_force_rls') table.rls_forced = false;
      if (event.type === 'create_policy') table.policies.add(event.policy);
      if (event.type === 'drop_policy') table.policies.delete(event.policy);
      if (event.type !== 'acl') continue;

      if (
        event.action === 'revoke'
        && event.all
        && TRACKED_ROLES.every((role) => event.roles.includes(role))
      ) {
        table.complete_acl_lockdowns.push({
          order,
          migration: event.migration,
          roles: [...TRACKED_ROLES],
        });
      }

      for (const role of event.roles.filter((value) => TRACKED_ROLES.includes(value))) {
        const roleState = table.acl.get(role);
        roleState.evidence.push({
          action: event.action,
          privileges: event.all ? ['all'] : event.privileges,
          migration: event.migration,
        });
        if (event.action === 'revoke') {
          if (event.all) {
            roleState.explicit_all_revoked = true;
            roleState.granted_privileges.clear();
            TABLE_PRIVILEGES.forEach((privilege) => roleState.revoked_privileges.add(privilege));
          } else {
            event.privileges.forEach((privilege) => {
              roleState.granted_privileges.delete(privilege);
              roleState.revoked_privileges.add(privilege);
            });
          }
        } else if (event.all) {
          roleState.explicit_all_revoked = false;
          roleState.revoked_privileges.clear();
          TABLE_PRIVILEGES.forEach((privilege) => roleState.granted_privileges.add(privilege));
        } else {
          event.privileges.forEach((privilege) => {
            roleState.revoked_privileges.delete(privilege);
            roleState.granted_privileges.add(privilege);
          });
        }
      }
    }
  }

  // Any top-level ACL statement that names a tracked table but cannot be
  // understood prevents the scanner from proving a controlled deny-all state.
  for (const event of events.filter((item) => item.type === 'ambiguous_acl')) {
    for (const table of tables.values()) {
      if (files[event.fileIndex]?.text?.toLowerCase().includes(table.table.toLowerCase())) {
        table.acl_ambiguities.push({ migration: event.migration, reason: event.reason });
      }
    }
  }

  const findings = [];
  const observations = [];
  for (const table of [...tables.values()].sort((a, b) => a.table.localeCompare(b.table))) {
    const policyCount = table.policies.size;
    const browserAcl = Object.fromEntries(BROWSER_ROLES.map((role) => [role, roleAclReport(table.acl.get(role))]));
    const browserGrants = BROWSER_ROLES.flatMap((role) =>
      browserAcl[role].granted_privileges.map((privilege) => ({ role, privilege })),
    );
    const allBrowserRolesExplicitlyRevoked = BROWSER_ROLES.every(
      (role) => browserAcl[role].explicitly_revoked && browserAcl[role].granted_privileges.length === 0,
    );
    const rlsLockdownFloor = Math.max(
      table.last_rls_enable_order ?? -1,
      table.last_force_rls_order ?? -1,
    );
    const completeAclLockdownAfterRls = table.complete_acl_lockdowns.some(
      (lockdown) => lockdown.order > rlsLockdownFloor,
    );
    const controlledDenyAll = table.sensitive
      && table.rls_enabled
      && table.rls_forced
      && policyCount === 0
      && allBrowserRolesExplicitlyRevoked
      && completeAclLockdownAfterRls
      && table.acl_ambiguities.length === 0;
    const stateSignature = aclStateSignature(table);

    if (!table.rls_enabled) {
      findings.push({
        severity: table.sensitive ? 'critical' : 'medium',
        code: 'RLS_NOT_ENABLED',
        table: table.table,
        created_in: table.created_in,
        acl_state_signature: stateSignature,
        message: 'Table is created in migrations but final migration state does not explicitly enable row level security.',
      });
    } else if (policyCount === 0 && table.sensitive && controlledDenyAll) {
      observations.push({
        severity: 'observation',
        code: 'CONTROLLED_DENY_ALL',
        table: table.table,
        created_in: table.created_in,
        rls_enabled: true,
        rls_forced: true,
        policy_count: 0,
        browser_acl: browserAcl,
        service_role_acl: roleAclReport(table.acl.get('service_role')),
        complete_acl_lockdown_after_rls: true,
        acl_state_signature: stateSignature,
        message: 'Sensitive table is structurally fail-closed: RLS is enabled and forced, no browser policy exists, an ordered complete tracked-role ACL lockdown follows the final RLS state, and final browser ACLs remain revoked.',
      });
    } else if (policyCount === 0 && table.sensitive) {
      const missing = [];
      if (!table.rls_forced) missing.push('force_rls');
      if (!completeAclLockdownAfterRls) missing.push('complete_role_acl_lockdown_after_rls');
      for (const role of BROWSER_ROLES) {
        if (!browserAcl[role].explicitly_revoked) missing.push(`explicit_${role}_revoke`);
      }
      if (table.acl_ambiguities.length) missing.push('unambiguous_acl_history');
      findings.push({
        severity: browserGrants.some((grant) => grant.role === 'public') ? 'critical' : 'high',
        code: browserGrants.length ? 'RLS_BROWSER_GRANT_WITHOUT_POLICY' : 'RLS_NO_POLICY_FOUND',
        table: table.table,
        created_in: table.created_in,
        missing_controlled_deny_all_proofs: missing,
        browser_grants: browserGrants,
        browser_acl: browserAcl,
        acl_ambiguities: table.acl_ambiguities,
        acl_state_signature: stateSignature,
        message: browserGrants.length
          ? 'Sensitive no-policy table has a final raw browser grant and is not controlled deny-all.'
          : 'Sensitive table has RLS but no policy and the controlled deny-all contract could not be proven.',
      });
    }
  }

  const summary = {
    migration_files_scanned: files.length,
    created_tables_detected: tables.size,
    tables_with_explicit_rls: [...tables.values()].filter((table) => table.rls_enabled).length,
    tables_with_forced_rls: [...tables.values()].filter((table) => table.rls_forced).length,
    tables_with_detected_policies: [...tables.values()].filter((table) => table.policies.size > 0).length,
    controlled_deny_all: observations.length,
    findings_total: findings.length,
    critical: findings.filter((finding) => finding.severity === 'critical').length,
    high: findings.filter((finding) => finding.severity === 'high').length,
    medium: findings.filter((finding) => finding.severity === 'medium').length,
    strict_passed: findings.every((finding) => !['critical', 'high'].includes(finding.severity)),
    note: 'Static audit only. CONTROLLED_DENY_ALL requires structural proof of ENABLE RLS, FORCE RLS, an ordered complete tracked-role ACL lockdown after the final RLS state, explicit final browser-role revocation, zero policies, zero later browser grants, and unambiguous ACL history.',
  };

  return {
    summary,
    findings,
    observations,
    sources: files.map((file) => file.path),
    table_states: [...tables.values()].map((table) => ({
      table: table.table,
      created_in: table.created_in,
      sensitive: table.sensitive,
      rls_enabled: table.rls_enabled,
      rls_forced: table.rls_forced,
      policies: [...table.policies].sort(),
      complete_acl_lockdowns: table.complete_acl_lockdowns,
      acl: Object.fromEntries(TRACKED_ROLES.map((role) => [role, roleAclReport(table.acl.get(role))])),
      acl_ambiguities: table.acl_ambiguities,
    })),
  };
}

export function compareRlsReports(baseReport, headReport, metadata = {}) {
  const baseBlockers = baseReport.findings.filter((finding) => ['critical', 'high'].includes(finding.severity));
  const headBlockers = headReport.findings.filter((finding) => ['critical', 'high'].includes(finding.severity));
  const baseByIdentity = new Map(baseBlockers.map((finding) => [blockerIdentity(finding), finding]));
  const headByIdentity = new Map(headBlockers.map((finding) => [blockerIdentity(finding), finding]));
  const inherited = [...headByIdentity].filter(([identity]) => baseByIdentity.has(identity)).map(([, finding]) => finding);
  const introduced = [...headByIdentity].filter(([identity]) => !baseByIdentity.has(identity)).map(([, finding]) => finding);
  const resolved = [...baseByIdentity].filter(([identity]) => !headByIdentity.has(identity)).map(([, finding]) => finding);

  return {
    generated_at: new Date().toISOString(),
    ...metadata,
    status: introduced.length === 0 ? 'passed' : 'failed_new_rls_blockers',
    summary: {
      base_unresolved_critical: baseBlockers.filter((finding) => finding.severity === 'critical').length,
      base_unresolved_high: baseBlockers.filter((finding) => finding.severity === 'high').length,
      inherited_unresolved_critical: inherited.filter((finding) => finding.severity === 'critical').length,
      inherited_unresolved_high: inherited.filter((finding) => finding.severity === 'high').length,
      resolved_critical: resolved.filter((finding) => finding.severity === 'critical').length,
      resolved_high: resolved.filter((finding) => finding.severity === 'high').length,
      new_critical: introduced.filter((finding) => finding.severity === 'critical').length,
      new_high: introduced.filter((finding) => finding.severity === 'high').length,
      new_unsafe_browser_grants: introduced.filter((finding) => finding.code === 'RLS_BROWSER_GRANT_WITHOUT_POLICY').length,
      head_controlled_deny_all: headReport.observations.filter((item) => item.code === 'CONTROLLED_DENY_ALL').length,
      strict_regression_passed: introduced.length === 0,
    },
    inherited_unresolved: inherited,
    resolved,
    introduced,
    controlled_deny_all: headReport.observations,
  };
}

export function loadMigrationFilesFromDirectory(root) {
  const migrationsDir = path.join(root, 'supabase', 'migrations');
  if (!fs.existsSync(migrationsDir)) return [];
  return fs.readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({
      path: `supabase/migrations/${name}`,
      text: fs.readFileSync(path.join(migrationsDir, name), 'utf8'),
    }));
}

function runGit(root, args) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error((result.stderr || result.stdout || result.error?.message || 'git command failed').trim());
  }
  return result.stdout.trim();
}

export function loadMigrationFilesFromGitRef(root, baseRef) {
  if (!String(baseRef || '').trim()) throw new Error('GRC_RLS_BASE_REF_REQUIRED');
  const resolvedRef = runGit(root, ['rev-parse', '--verify', `${baseRef}^{commit}`]);
  const names = runGit(root, ['ls-tree', '-r', '--name-only', resolvedRef, '--', 'supabase/migrations'])
    .split(/\r?\n/)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  if (names.length === 0) throw new Error(`GRC_RLS_BASE_MIGRATIONS_UNAVAILABLE:${resolvedRef}`);
  return {
    resolvedRef,
    files: names.map((name) => ({
      path: name.replaceAll('\\', '/'),
      text: runGit(root, ['show', `${resolvedRef}:${name}`]),
    })),
  };
}

export function currentGitHead(root) {
  return runGit(root, ['rev-parse', 'HEAD']);
}
