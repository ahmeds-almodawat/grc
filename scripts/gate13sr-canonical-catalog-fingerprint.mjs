import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  normalizeSchemaDump,
  splitSqlStatements,
} from './gate11-immutable-baseline.mjs';

export const CONTRACT_VERSION = 'gate13sr-canonical-post187-catalog-v1';

const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

function statementHead(statement) {
  return statement.replace(/^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/, '').trim();
}

function collapseOutsideLiterals(value) {
  let output = '';
  let whitespace = false;
  let single = false;
  let double = false;
  let dollar = null;
  for (let index = 0; index < value.length;) {
    if (dollar) {
      if (value.startsWith(dollar, index)) {
        output += dollar;
        index += dollar.length;
        dollar = null;
      } else {
        output += value[index++];
      }
      continue;
    }
    const current = value[index];
    const next = value[index + 1];
    if (single) {
      output += current;
      if (current === "'" && next === "'") { output += next; index += 2; continue; }
      if (current === "'") single = false;
      index += 1;
      continue;
    }
    if (double) {
      output += current;
      if (current === '"' && next === '"') { output += next; index += 2; continue; }
      if (current === '"') double = false;
      index += 1;
      continue;
    }
    if (current === "'") { if (whitespace && output) output += ' '; whitespace = false; single = true; output += current; index += 1; continue; }
    if (current === '"') { if (whitespace && output) output += ' '; whitespace = false; double = true; output += current; index += 1; continue; }
    if (current === '$') {
      const match = value.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        if (whitespace && output) output += ' ';
        whitespace = false;
        dollar = match[0];
        output += dollar;
        index += dollar.length;
        continue;
      }
    }
    if (/\s/.test(current)) { whitespace = true; index += 1; continue; }
    if (whitespace && output) output += ' ';
    whitespace = false;
    output += current;
    index += 1;
  }
  return output.trim();
}

export function canonicalizeStatement(statement) {
  return collapseOutsideLiterals(statementHead(statement))
    .replace(/^CREATE OR REPLACE FUNCTION /i, 'CREATE FUNCTION ')
    .replace(/^CREATE OR REPLACE PROCEDURE /i, 'CREATE PROCEDURE ')
    .replace(/^CREATE OR REPLACE VIEW /i, 'CREATE VIEW ')
    .replace(/^CREATE OR REPLACE TRIGGER /i, 'CREATE TRIGGER ')
    .replace(/^CREATE TABLE IF NOT EXISTS /i, 'CREATE TABLE ')
    .replace(/^CREATE SEQUENCE IF NOT EXISTS /i, 'CREATE SEQUENCE ')
    .replace(/^CREATE SCHEMA IF NOT EXISTS /i, 'CREATE SCHEMA ')
    .replace(/;$/, '')
    .trim();
}

function compactIdentifier(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function matchIdentity(sql, regex, category, field = 'definition') {
  const match = sql.match(regex);
  if (!match) return null;
  return { category, identity: compactIdentifier(match[1]), field };
}

function grantIdentity(sql, verb) {
  const regex = verb === 'grant'
    ? /^GRANT\s+(.+?)\s+ON\s+(.+?)\s+TO\s+(.+?)(?:\s+WITH GRANT OPTION)?$/i
    : /^REVOKE\s+(.+?)\s+ON\s+(.+?)\s+FROM\s+(.+)$/i;
  const match = sql.match(regex);
  if (!match) return null;
  return {
    category: verb,
    identity: `${compactIdentifier(match[2])}|grantee=${compactIdentifier(match[3])}`,
    field: 'privileges',
  };
}

export function identifyCatalogStatement(sql) {
  const rules = [
    () => matchIdentity(sql, /^CREATE SCHEMA\s+([^\s]+)$/i, 'schema'),
    () => matchIdentity(sql, /^CREATE TYPE\s+([^\s]+)\s+AS\s+/i, 'type'),
    () => matchIdentity(sql, /^CREATE DOMAIN\s+([^\s]+)\s+/i, 'domain'),
    () => matchIdentity(sql, /^CREATE SEQUENCE\s+([^\s]+)(?:\s|$)/i, 'sequence'),
    () => matchIdentity(sql, /^CREATE TABLE\s+([^\s(]+)\s*\(/i, 'table'),
    () => matchIdentity(sql, /^CREATE MATERIALIZED VIEW\s+([^\s]+)\s+/i, 'materialized_view'),
    () => matchIdentity(sql, /^CREATE VIEW\s+([^\s]+)\s+/i, 'view'),
    () => matchIdentity(sql, /^CREATE FUNCTION\s+(.+?\))\s+RETURNS\s+/i, 'function'),
    () => matchIdentity(sql, /^CREATE PROCEDURE\s+(.+?\))\s+/i, 'procedure'),
    () => matchIdentity(sql, /^CREATE(?: UNIQUE)? INDEX\s+([^\s]+)\s+ON\s+/i, 'index'),
    () => {
      const match = sql.match(/^ALTER TABLE(?: ONLY)?\s+([^\s]+)\s+ADD CONSTRAINT\s+([^\s]+)\s+/i);
      return match ? { category: 'constraint', identity: `${match[1]}|${match[2]}`, field: 'definition' } : null;
    },
    () => {
      const match = sql.match(/^CREATE TRIGGER\s+([^\s]+).*?\s+ON\s+([^\s]+)\s+/i);
      return match ? { category: 'trigger', identity: `${match[2]}|${match[1]}`, field: 'definition' } : null;
    },
    () => {
      const match = sql.match(/^CREATE POLICY\s+([^\s]+)\s+ON\s+([^\s]+)\s+/i);
      return match ? { category: 'policy', identity: `${match[2]}|${match[1]}`, field: 'definition' } : null;
    },
    () => {
      const match = sql.match(/^ALTER TABLE(?: ONLY)?\s+([^\s]+)\s+(ENABLE|DISABLE|FORCE|NO FORCE) ROW LEVEL SECURITY$/i);
      return match ? { category: 'rls', identity: match[1], field: match[2].toLowerCase().replace(' ', '_') } : null;
    },
    () => grantIdentity(sql, 'grant'),
    () => grantIdentity(sql, 'revoke'),
    () => matchIdentity(sql, /^ALTER DEFAULT PRIVILEGES\s+(.+)$/i, 'default_privilege', 'definition'),
    () => {
      const match = sql.match(/^COMMENT ON\s+(.+?)\s+IS\s+/i);
      return match ? { category: 'comment', identity: compactIdentifier(match[1]), field: 'comment' } : null;
    },
    () => {
      const match = sql.match(/^ALTER\s+(SCHEMA|TYPE|TABLE|FUNCTION|PROCEDURE|VIEW|MATERIALIZED VIEW|SEQUENCE)\s+(.+?)\s+OWNER TO\s+(.+)$/i);
      return match ? { category: 'owner', identity: `${match[1].toLowerCase()}|${compactIdentifier(match[2])}`, field: 'owner' } : null;
    },
    () => {
      const match = sql.match(/^ALTER TABLE(?: ONLY)?\s+([^\s]+)\s+ALTER COLUMN\s+([^\s]+)\s+(SET DEFAULT|DROP DEFAULT|SET NOT NULL|DROP NOT NULL|SET STATISTICS|SET STORAGE|SET COMPRESSION|ADD GENERATED|DROP IDENTITY|SET GENERATED)\b/i);
      return match ? {
        category: 'column',
        identity: `${match[1]}|${match[2]}`,
        field: match[3].toLowerCase().replace(/\s+/g, '_'),
      } : null;
    },
    () => {
      const match = sql.match(/^ALTER TABLE(?: ONLY)?\s+([^\s]+)\s+(.+)$/i);
      return match ? {
        category: 'table_alter',
        identity: `${match[1]}|action=${sha256(match[2]).slice(0, 24)}`,
        field: 'definition',
      } : null;
    },
  ];
  for (const rule of rules) {
    const result = rule();
    if (result) return result;
  }
  return { category: 'other', identity: `statement|${sha256(sql).slice(0, 24)}`, field: 'definition' };
}

function splitTopLevelList(value) {
  const items = [];
  let start = 0;
  let depth = 0;
  let single = false;
  let double = false;
  for (let index = 0; index < value.length; index += 1) {
    const current = value[index];
    const next = value[index + 1];
    if (single) {
      if (current === "'" && next === "'") { index += 1; continue; }
      if (current === "'") single = false;
      continue;
    }
    if (double) {
      if (current === '"' && next === '"') { index += 1; continue; }
      if (current === '"') double = false;
      continue;
    }
    if (current === "'") { single = true; continue; }
    if (current === '"') { double = true; continue; }
    if (current === '(') depth += 1;
    else if (current === ')') depth -= 1;
    else if (current === ',' && depth === 0) {
      items.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  items.push(value.slice(start).trim());
  return items.filter(Boolean);
}

function expandTableColumns(canonical, tableIdentity) {
  const open = canonical.indexOf('(');
  const close = canonical.lastIndexOf(')');
  if (open < 0 || close <= open) return [];
  const records = [];
  for (const definition of splitTopLevelList(canonical.slice(open + 1, close))) {
    if (/^(?:CONSTRAINT|PRIMARY KEY|UNIQUE|CHECK|FOREIGN KEY)\b/i.test(definition)) continue;
    const columnMatch = definition.match(/^("(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)\s+(.+)$/s);
    if (!columnMatch) continue;
    const columnIdentity = `${tableIdentity}|${columnMatch[1]}`;
    records.push({
      category: 'column',
      identity: columnIdentity,
      field: 'definition',
      value_sha256: sha256(definition),
      canonical_bytes: Buffer.byteLength(definition, 'utf8'),
    });
    const defaultMatch = columnMatch[2].match(/\bDEFAULT\s+(.+?)(?=\s+(?:NOT NULL|NULL|COLLATE|GENERATED|CONSTRAINT|PRIMARY KEY|UNIQUE|CHECK|REFERENCES)\b|$)/is);
    if (defaultMatch) {
      const normalizedDefault = collapseOutsideLiterals(defaultMatch[1]);
      records.push({
        category: 'column_default',
        identity: columnIdentity,
        field: 'expression',
        value_sha256: sha256(normalizedDefault),
        canonical_bytes: Buffer.byteLength(normalizedDefault, 'utf8'),
      });
    }
  }
  return records;
}

function isIgnored(statement) {
  const sql = statementHead(statement);
  if (!sql || /^SET\s+/i.test(sql) || /^SELECT pg_catalog\.set_config\(/i.test(sql)) return true;
  if (/^\\(?:un)?restrict\s+/i.test(sql)) return true;
  // Supabase owns these platform defaults and its supported db-dump path
  // removes them. Application-owned default privileges remain fingerprinted.
  if (/^ALTER DEFAULT PRIVILEGES FOR ROLE "?supabase_admin"?\b/i.test(sql)) return true;
  if (/^CREATE SCHEMA(?: IF NOT EXISTS)?\s+"?public"?$/i.test(sql)) return false;
  return false;
}

export function buildCanonicalCatalogFingerprint(rawSql, metadata = {}) {
  const parsedRecords = splitSqlStatements(normalizeSchemaDump(rawSql))
    .filter((statement) => !isIgnored(statement))
    .flatMap((statement) => {
      const canonical = canonicalizeStatement(statement);
      const identity = identifyCatalogStatement(canonical);
      if (
        /(?:\bTO|\bFROM|OWNER TO)\s+"?\d+"?(?:\s|$)/i.test(canonical)
        && ['grant', 'revoke', 'owner', 'policy', 'default_privilege'].includes(identity.category)
      ) {
        throw new Error(`GATE13SR_UNRESOLVED_ROLE_IDENTIFIER:${identity.identity}`);
      }
      const record = {
        ...identity,
        value_sha256: sha256(canonical),
        canonical_bytes: Buffer.byteLength(canonical, 'utf8'),
      };
      return identity.category === 'table'
        ? [record, ...expandTableColumns(canonical, identity.identity)]
        : [record];
    });

  // pg_dump emits a placeholder CREATE VIEW before the final definition when
  // it breaks circular view dependencies. The last definition is the catalog
  // state; retaining the placeholder would fingerprint dump mechanics rather
  // than the final view contract.
  const byStableKey = new Map();
  for (const record of parsedRecords) {
    const key = `${record.category}|${record.identity}|${record.field}`;
    const previous = byStableKey.get(key);
    if (!previous || previous.value_sha256 === record.value_sha256 || record.category === 'view') {
      byStableKey.set(key, record);
      continue;
    }
    throw new Error(`GATE13SR_DUPLICATE_STABLE_IDENTITY:${key}`);
  }

  const records = [...byStableKey.values()]
    .sort((left, right) => {
      const a = `${left.category}\0${left.identity}\0${left.field}\0${left.value_sha256}`;
      const b = `${right.category}\0${right.identity}\0${right.field}\0${right.value_sha256}`;
      return a.localeCompare(b, 'en');
    });

  const canonicalRecords = records.map((record) => JSON.stringify(record)).join('\n') + '\n';
  const objectCounts = records.reduce((counts, record) => {
    counts[record.category] = (counts[record.category] ?? 0) + 1;
    return counts;
  }, {});
  return {
    contract_version: CONTRACT_VERSION,
    scope: 'application-managed public schema metadata only',
    ...metadata,
    record_count: records.length,
    object_counts: Object.fromEntries(Object.entries(objectCounts).sort(([a], [b]) => a.localeCompare(b, 'en'))),
    catalog_sha256: sha256(canonicalRecords),
    records,
  };
}

export function compareCanonicalFingerprints(expected, hosted) {
  if (expected.contract_version !== CONTRACT_VERSION || hosted.contract_version !== CONTRACT_VERSION) {
    throw new Error('GATE13SR_FINGERPRINT_CONTRACT_VERSION_MISMATCH');
  }
  const keyOf = (record) => `${record.category}|${record.identity}|${record.field}`;
  const left = new Map(expected.records.map((record) => [keyOf(record), record]));
  const right = new Map(hosted.records.map((record) => [keyOf(record), record]));
  const keys = [...new Set([...left.keys(), ...right.keys()])].sort((a, b) => a.localeCompare(b, 'en'));
  const differences = [];
  for (const key of keys) {
    const expectedRecord = left.get(key);
    const hostedRecord = right.get(key);
    if (!expectedRecord) {
      differences.push({ key, category: hostedRecord.category, identity: hostedRecord.identity, field: hostedRecord.field, classification: 'missing_expected_object', expected_value_sha256: null, hosted_value_sha256: hostedRecord.value_sha256 });
    } else if (!hostedRecord) {
      differences.push({ key, category: expectedRecord.category, identity: expectedRecord.identity, field: expectedRecord.field, classification: 'missing_hosted_object', expected_value_sha256: expectedRecord.value_sha256, hosted_value_sha256: null });
    } else if (expectedRecord.value_sha256 !== hostedRecord.value_sha256) {
      differences.push({ key, category: expectedRecord.category, identity: expectedRecord.identity, field: expectedRecord.field, classification: 'semantic_value_drift', expected_value_sha256: expectedRecord.value_sha256, hosted_value_sha256: hostedRecord.value_sha256 });
    }
  }
  return {
    contract_version: CONTRACT_VERSION,
    expected_catalog_sha256: expected.catalog_sha256,
    hosted_catalog_sha256: hosted.catalog_sha256,
    exact_match: differences.length === 0,
    difference_count: differences.length,
    differences,
  };
}

function requireArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`GATE13SR_ARGUMENT_REQUIRED:${name}`);
  return process.argv[index + 1];
}

function runCli() {
  const command = process.argv[2];
  if (command === 'fingerprint') {
    const input = requireArg('input');
    const output = requireArg('output');
    const result = buildCanonicalCatalogFingerprint(readFileSync(input, 'utf8'));
    const json = JSON.stringify(result, null, 2) + '\n';
    writeFileSync(output, json, 'utf8');
    writeFileSync(requireArg('sha-output'), `${sha256(json)}  ${basename(output)}\n`, 'utf8');
    return;
  }
  if (command === 'compare') {
    const expected = JSON.parse(readFileSync(requireArg('expected'), 'utf8'));
    const hosted = JSON.parse(readFileSync(requireArg('hosted'), 'utf8'));
    const result = compareCanonicalFingerprints(expected, hosted);
    writeFileSync(requireArg('output'), JSON.stringify(result, null, 2) + '\n', 'utf8');
    if (!result.exact_match) process.exitCode = 2;
    return;
  }
  throw new Error('GATE13SR_COMMAND_REQUIRED');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCli();
