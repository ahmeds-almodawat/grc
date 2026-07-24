import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const SESSION_PREFIXES = [
  'SET statement_timeout',
  'SET lock_timeout',
  'SET idle_in_transaction_session_timeout',
  'SET client_encoding',
  'SET standard_conforming_strings',
  "SELECT pg_catalog.set_config('search_path'",
  'SET check_function_bodies',
  'SET xmloption',
  'SET client_min_messages',
  'SET row_security',
];

const OWNER_STATEMENT = /^ALTER\s+(?:SCHEMA|TYPE|TABLE|FUNCTION|PROCEDURE|VIEW|MATERIALIZED\s+VIEW|SEQUENCE)\s+[\s\S]+?\s+OWNER\s+TO\s+[^;]+;$/i;
const PUBLIC_SCHEMA_SCAFFOLD = /^(?:CREATE SCHEMA (?:IF NOT EXISTS )?"?public"?|COMMENT ON SCHEMA "?public"?)/i;

export function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function normalizeText(value) {
  return value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim() + '\n';
}

export function normalizeSchemaDump(value) {
  // PostgreSQL 17 emits a fresh random client-side \restrict token for every
  // pg_dump invocation. It is not catalog state and must never influence an
  // immutable catalog fingerprint or baseline payload.
  return normalizeText(value).replace(/^\\(?:un)?restrict\s+[^\n]+\n/gm, '');
}

export function splitSqlStatements(sql) {
  const statements = [];
  let start = 0;
  let index = 0;
  let single = false;
  let double = false;
  let lineComment = false;
  let blockComment = 0;
  let dollarTag = null;

  while (index < sql.length) {
    const current = sql[index];
    const next = sql[index + 1];

    if (lineComment) {
      if (current === '\n') lineComment = false;
      index += 1;
      continue;
    }
    if (blockComment > 0) {
      if (current === '/' && next === '*') { blockComment += 1; index += 2; continue; }
      if (current === '*' && next === '/') { blockComment -= 1; index += 2; continue; }
      index += 1;
      continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, index)) { index += dollarTag.length; dollarTag = null; continue; }
      index += 1;
      continue;
    }
    if (single) {
      if (current === "'" && next === "'") { index += 2; continue; }
      if (current === "'") single = false;
      index += 1;
      continue;
    }
    if (double) {
      if (current === '"' && next === '"') { index += 2; continue; }
      if (current === '"') double = false;
      index += 1;
      continue;
    }

    if (current === '-' && next === '-') { lineComment = true; index += 2; continue; }
    if (current === '/' && next === '*') { blockComment = 1; index += 2; continue; }
    if (current === "'") { single = true; index += 1; continue; }
    if (current === '"') { double = true; index += 1; continue; }
    if (current === '$') {
      const match = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) { dollarTag = match[0]; index += dollarTag.length; continue; }
    }
    if (current === ';') {
      const statement = sql.slice(start, index + 1).trim();
      if (statement) statements.push(statement);
      start = index + 1;
    }
    index += 1;
  }
  const remainder = sql.slice(start).trim();
  if (remainder) statements.push(remainder);
  return statements;
}

function statementHead(statement) {
  return statement.replace(/^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/, '').trim();
}

export function isCatalogStatement(statement) {
  const head = statementHead(statement);
  if (!head) return false;
  if (/^SET\s+/i.test(head)) return false;
  if (SESSION_PREFIXES.some((prefix) => head.startsWith(prefix))) return false;
  if (OWNER_STATEMENT.test(head)) return false;
  if (PUBLIC_SCHEMA_SCAFFOLD.test(head)) return false;
  return true;
}

export function classifyStatement(statement) {
  const head = statementHead(statement).replace(/\s+/g, ' ');
  const patterns = [
    ['type', /^CREATE TYPE /i],
    ['domain', /^CREATE DOMAIN /i],
    ['sequence', /^CREATE SEQUENCE /i],
    ['table', /^CREATE TABLE /i],
    ['function', /^CREATE OR REPLACE FUNCTION /i],
    ['procedure', /^CREATE OR REPLACE PROCEDURE /i],
    ['materialized_view', /^CREATE MATERIALIZED VIEW /i],
    ['view', /^CREATE OR REPLACE VIEW /i],
    ['constraint', /^ALTER TABLE .* ADD CONSTRAINT /i],
    ['index', /^CREATE (?:UNIQUE )?INDEX /i],
    ['trigger', /^CREATE OR REPLACE TRIGGER /i],
    ['policy', /^CREATE POLICY /i],
    ['rls', /^ALTER TABLE .* (?:ENABLE|FORCE|DISABLE|NO FORCE) ROW LEVEL SECURITY/i],
    ['grant', /^GRANT /i],
    ['revoke', /^REVOKE /i],
    ['default_privilege', /^ALTER DEFAULT PRIVILEGES /i],
    ['comment', /^COMMENT ON /i],
    ['alter', /^ALTER /i],
  ];
  return patterns.find(([, pattern]) => pattern.test(head))?.[0] ?? 'other';
}

export function buildCatalogFingerprint(rawSql) {
  const normalized = normalizeSchemaDump(rawSql);
  const statements = splitSqlStatements(normalized)
    .filter(isCatalogStatement)
    .map((statement) => normalizeCatalogStatement(statement));
  const records = statements.map((statement, ordinal) => ({
    ordinal: ordinal + 1,
    kind: classifyStatement(statement),
    bytes: Buffer.byteLength(statement, 'utf8'),
    sha256: sha256(statement),
  }));
  const canonical = statements.join('\n\n') + '\n';
  const objectCounts = records.reduce((counts, record) => {
    counts[record.kind] = (counts[record.kind] ?? 0) + 1;
    return counts;
  }, {});
  return {
    format_version: 'gate11-normalized-public-catalog-v1',
    scope: 'application-managed public schema; schema metadata only',
    canonical_statement_count: records.length,
    canonical_sql_sha256: sha256(canonical),
    object_counts: Object.fromEntries(Object.entries(objectCounts).sort(([a], [b]) => a.localeCompare(b))),
    statements: records,
  };
}

function normalizeCatalogStatement(statement) {
  const normalized = normalizeText(statement).trim();
  // PostgreSQL 17 may flatten associative AND nodes after a schema-only dump is
  // replayed. These two generated identifier checks are semantically identical
  // before and after replay, but pg_dump renders one additional pair of
  // parentheses on the first pass. Canonicalize only these named constraints so
  // the catalog fingerprint is stable without weakening expression comparison
  // for any authorization, RLS, ACL, or general CHECK contract.
  const identifierChecks = [
    ['patch83b_legacy_runtime_bridges_bridge_id_check', 'bridge_id'],
    ['patch83b_release_migration_events_event_key_check', 'event_key'],
  ];
  return identifierChecks.reduce((sql, [constraint, column]) => {
    const line = `    CONSTRAINT ${constraint} CHECK (((length(${column}) >= 1) AND (length(${column}) <= 160) AND (${column} ~ '^[a-z0-9:._-]+$'::text)))`;
    const pattern = new RegExp(`^\\s*CONSTRAINT ${constraint} CHECK .*$`, 'm');
    return sql.replace(pattern, line);
  }, normalized);
}

export function countCreatedObjectIdentities(rawSql) {
  const statements = splitSqlStatements(normalizeSchemaDump(rawSql));
  const qualifiedPublicName = String.raw`(?:"public"|public)\.(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)`;
  const identities = {
    table: new Set(),
    view: new Set(),
    function: new Set(),
    policy: new Set(),
  };
  for (const statement of statements) {
    const head = statementHead(statement).replace(/\s+/g, ' ');
    let match = head.match(new RegExp(`^CREATE TABLE (?:IF NOT EXISTS )?(${qualifiedPublicName})`, 'i'));
    if (match) { identities.table.add(match[1]); continue; }
    match = head.match(new RegExp(`^CREATE (?:OR REPLACE )?VIEW (${qualifiedPublicName})`, 'i'));
    if (match) { identities.view.add(match[1]); continue; }
    match = head.match(new RegExp(`^CREATE MATERIALIZED VIEW (${qualifiedPublicName})`, 'i'));
    if (match) { identities.view.add(match[1]); continue; }
    match = head.match(new RegExp(`^CREATE (?:OR REPLACE )?FUNCTION (${qualifiedPublicName}\\s*\\([^)]*\\))`, 'i'));
    if (match) { identities.function.add(match[1]); continue; }
    match = head.match(new RegExp(`^CREATE POLICY ("[^"]+"|[A-Za-z_][A-Za-z0-9_$]*) ON (${qualifiedPublicName})`, 'i'));
    if (match) identities.policy.add(`${match[2]}:${match[1]}`);
  }
  return Object.fromEntries(Object.entries(identities).map(([kind, values]) => [kind, values.size]));
}

export function scanBaseline(sql) {
  const checks = {
    email_addresses: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    jwt_values: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,
    secret_keys: /sb_secret_[A-Za-z0-9_-]+/g,
    connection_strings: /postgres(?:ql)?:\/\/[^\s'";]+/gi,
    project_references: /(?:zghsgzrdwbqdrpuxanac|zbrjjecpsrzposhuarcn)/g,
    auth_data_writes: /^\s*(?:INSERT|UPDATE|DELETE|COPY)\b[^;]*(?:auth\."?(?:users|sessions|refresh_tokens|identities)"?)/gim,
    storage_data_writes: /^\s*(?:INSERT|UPDATE|DELETE|COPY)\b[^;]*(?:storage\."?(?:objects|buckets)"?)/gim,
    raw_role_oids: /unknown \(OID=\d+\)/gi,
  };
  const result = Object.fromEntries(Object.entries(checks).map(([name, pattern]) => [name, [...sql.matchAll(pattern)].length]));
  const dataStatements = splitSqlStatements(normalizeText(sql))
    .map(statementHead)
    .filter((statement) => /^(?:INSERT\s+INTO|COPY\s+)/i.test(statement));
  const approvedRuntimeSeeds = dataStatements.filter((statement) =>
    /^INSERT\s+INTO\s+"public"\."patch83u_runtime_control"/i.test(statement));
  result.top_level_data_statements = dataStatements.length;
  result.approved_structural_runtime_seeds = approvedRuntimeSeeds.length;
  result.unapproved_top_level_data_statements = dataStatements.length - approvedRuntimeSeeds.length;
  return result;
}

export function buildBaseline(rawSql, metadata) {
  const baselineVersion = metadata.baselineVersion ?? 1;
  const migrationCeiling = metadata.migrationCeiling ?? 184;
  const firstFutureMigration = metadata.firstFutureMigration ?? (migrationCeiling + 1);
  const source = normalizeSchemaDump(rawSql);
  const bodyStatements = splitSqlStatements(source).filter((statement) => {
    const head = statementHead(statement);
    if (OWNER_STATEMENT.test(head)) return false;
    if (PUBLIC_SCHEMA_SCAFFOLD.test(head)) return false;
    return true;
  });
  const body = bodyStatements.map((statement) => normalizeText(statement).trim()).join('\n\n');
  const header = `-- GRC Platform immutable application baseline v1 through migration 184.\n-- Generated from approved schema-only staging catalog metadata; contains no table rows.\n-- DO NOT EDIT after release. Corrections require a new baseline and forward migration.\n-- Target catalog SHA-256: ${metadata.catalogSha256}\n\nBEGIN;\n\nDO $gate11$\nBEGIN\n  IF current_setting('server_version_num')::integer < 170000 THEN\n    RAISE EXCEPTION 'GATE11_POSTGRES_17_REQUIRED';\n  END IF;\n  IF to_regnamespace('auth') IS NULL OR to_regnamespace('storage') IS NULL OR to_regnamespace('extensions') IS NULL THEN\n    RAISE EXCEPTION 'GATE11_SUPABASE_PLATFORM_SCHEMAS_REQUIRED';\n  END IF;\n  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')\n     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')\n     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN\n    RAISE EXCEPTION 'GATE11_SUPABASE_API_ROLES_REQUIRED';\n  END IF;\n  IF EXISTS (\n    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace\n    WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S')\n  ) OR EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype IN ('e','d','c') AND t.typrelid=0) THEN\n    RAISE EXCEPTION 'GATE11_BASELINE_ALREADY_PRESENT';\n  END IF;\nEND\n$gate11$;\n\nCREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";\nCREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";\n\n-- Neutralize platform creation-time ACL defaults. The approved object ACLs and\n-- future-object defaults are restored explicitly by the captured catalog below.\nALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon", "authenticated", "service_role";\nALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "anon", "authenticated", "service_role";\nALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "anon", "authenticated", "service_role";\n\n`;
  const footer = `\n\n-- Approved immutable structural seed. It contains no person, tenant, or hosted\n-- environment identifier and keeps an empty bootstrap fail-closed.\nINSERT INTO "public"."patch83u_runtime_control" (\n  "singleton", "schema_version", "enforcement_state",\n  "expected_edge_contract_version", "expected_frontend_contract_version",\n  "compatible_edge_contract_version", "compatible_frontend_contract_version",\n  "state_version", "created_at", "updated_at"\n) VALUES (\n  true, '174.2-auth-first', 'disabled',\n  'patch83u-edge-auth-first-v1', 'patch83u-frontend-auth-first-v1',\n  NULL, NULL,\n  0, TIMESTAMPTZ '1970-01-01 00:00:00+00', TIMESTAMPTZ '1970-01-01 00:00:00+00'\n);\n\nDO $gate11_validate$\nDECLARE\n  actual_tables integer;\n  actual_views integer;\n  actual_functions integer;\n  actual_policies integer;\nBEGIN\n  SELECT count(*) INTO actual_tables FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p');\n  SELECT count(*) INTO actual_views FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('v','m');\n  SELECT count(*) INTO actual_functions FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public';\n  SELECT count(*) INTO actual_policies FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public';\n  IF actual_tables <> ${metadata.tableCount} OR actual_views <> ${metadata.viewCount}\n     OR actual_functions <> ${metadata.functionCount} OR actual_policies <> ${metadata.policyCount} THEN\n    RAISE EXCEPTION 'GATE11_BASELINE_OBJECT_COUNT_MISMATCH tables=% views=% functions=% policies=%', actual_tables, actual_views, actual_functions, actual_policies;\n  END IF;\n  IF NOT EXISTS (\n    SELECT 1 FROM public.patch83u_runtime_control\n    WHERE singleton AND enforcement_state='disabled' AND state_version=0\n      AND compatible_edge_contract_version IS NULL\n      AND compatible_frontend_contract_version IS NULL\n      AND designated_super_admin_id IS NULL\n  ) THEN\n    RAISE EXCEPTION 'GATE11_RUNTIME_STRUCTURAL_SEED_INVALID';\n  END IF;\nEND\n$gate11_validate$;\n\nCOMMIT;\n`;
  const versionedHeader = header
    .replace(
      'immutable application baseline v1 through migration 184.',
      `immutable application baseline v${baselineVersion} through migration ${migrationCeiling}.`,
    )
    .replace(
      `-- Target catalog SHA-256: ${metadata.catalogSha256}\n`,
      `-- Target catalog SHA-256: ${metadata.catalogSha256}\n-- First shared forward migration: ${firstFutureMigration}.\n`,
    );
  return normalizeText(versionedHeader + body + footer);
}

function requireArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`GATE11_ARGUMENT_REQUIRED:${name}`);
  return process.argv[index + 1];
}

function optionalArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function runCli() {
  const command = process.argv[2];
  if (command === 'fingerprint') {
    const raw = readFileSync(requireArg('input'), 'utf8');
    const out = requireArg('output');
    const result = buildCatalogFingerprint(raw);
    const sourceRawSha256 = optionalArg('source-raw-sha256');
    const normalizationMethod = optionalArg('normalization-method');
    if (sourceRawSha256) result.source_raw_schema_sha256 = sourceRawSha256;
    if (normalizationMethod) result.normalization_method = normalizationMethod;
    const json = JSON.stringify(result, null, 2) + '\n';
    writeFileSync(out, json, 'utf8');
    const shaFile = requireArg('sha-output');
    writeFileSync(shaFile, `${sha256(json)}  ${basename(out)}\n`, 'utf8');
    return;
  }
  if (command === 'build') {
    const raw = readFileSync(requireArg('input'), 'utf8');
    const fingerprint = buildCatalogFingerprint(raw);
    const identities = countCreatedObjectIdentities(raw);
    const baseline = buildBaseline(raw, {
      catalogSha256: optionalArg('target-catalog-sha256') ?? fingerprint.canonical_sql_sha256,
      baselineVersion: Number(optionalArg('baseline-version') ?? 1),
      migrationCeiling: Number(optionalArg('migration-ceiling') ?? 184),
      firstFutureMigration: Number(optionalArg('first-future-migration') ?? 185),
      tableCount: identities.table,
      viewCount: identities.view,
      functionCount: identities.function,
      policyCount: identities.policy,
    });
    const scan = scanBaseline(baseline);
    const prohibitedScan = Object.entries(scan).filter(([name]) => ![
      'top_level_data_statements',
      'approved_structural_runtime_seeds',
    ].includes(name));
    if (prohibitedScan.some(([, count]) => count !== 0)
        || scan.top_level_data_statements !== 1
        || scan.approved_structural_runtime_seeds !== 1) {
      throw new Error(`GATE11_BASELINE_SECURITY_SCAN_FAILED:${JSON.stringify(scan)}`);
    }
    writeFileSync(requireArg('output'), baseline, 'utf8');
    return;
  }
  throw new Error('GATE11_COMMAND_REQUIRED');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCli();
