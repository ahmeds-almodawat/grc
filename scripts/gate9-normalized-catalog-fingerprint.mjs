import { createHash } from 'node:crypto';

const ROLE_FIELD = /(^|\|)roles=([^|]*)(?=\||$)/;
const OWNER_FIELD = /(^|\|)owner=([^|]*)(?=\||$)/;

function stableUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, 'en'));
}

function requireRoleName(identifier, roleCatalog) {
  const key = String(identifier).trim();
  if (!key) throw new Error('GATE9_EMPTY_ROLE_IDENTIFIER');

  const resolved = roleCatalog instanceof Map
    ? roleCatalog.get(key)
    : roleCatalog?.[key];

  if (typeof resolved !== 'string' || !resolved.trim()) {
    throw new Error(`GATE9_UNRESOLVED_ROLE_IDENTIFIER:${key}`);
  }
  return resolved.trim();
}

export function normalizeRoleIdentifiers(identifiers, roleCatalog) {
  if (!Array.isArray(identifiers) || identifiers.length === 0) {
    throw new Error('GATE9_POLICY_ROLES_REQUIRED');
  }
  return stableUnique(identifiers.map((identifier) => requireRoleName(identifier, roleCatalog)));
}

export function normalizeOwnerIdentifier(identifier, roleCatalog) {
  return requireRoleName(identifier, roleCatalog);
}

export function normalizeCatalogLine(line, roleCatalog) {
  if (typeof line !== 'string' || !line) throw new Error('GATE9_CATALOG_LINE_REQUIRED');

  let normalized = line.replace(ROLE_FIELD, (match, prefix, rawRoles) => {
    const identifiers = rawRoles.split(',').map((value) => value.trim()).filter(Boolean);
    return `${prefix}roles=${normalizeRoleIdentifiers(identifiers, roleCatalog).join(',')}`;
  });

  normalized = normalized.replace(OWNER_FIELD, (match, prefix, rawOwner) => {
    return `${prefix}owner=${normalizeOwnerIdentifier(rawOwner, roleCatalog)}`;
  });

  return normalized;
}

export function buildStableCatalogFingerprint(canonicalLines, roleCatalog) {
  if (!Array.isArray(canonicalLines) || canonicalLines.length === 0) {
    throw new Error('GATE9_CANONICAL_LINES_REQUIRED');
  }

  const stableLines = canonicalLines
    .map((line) => normalizeCatalogLine(line, roleCatalog))
    .sort((left, right) => left.localeCompare(right, 'en'));
  const stableText = stableLines.join('\n');

  return {
    canonical_lines: stableLines,
    canonical_line_count: stableLines.length,
    catalog_sha256: createHash('sha256').update(stableText, 'utf8').digest('hex'),
  };
}

export function assertNoRawRoleIdentifiers(canonicalLines) {
  for (const line of canonicalLines) {
    const roles = line.match(ROLE_FIELD)?.[2]?.split(',').map((value) => value.trim()) ?? [];
    const owner = line.match(OWNER_FIELD)?.[2]?.trim();
    if (roles.some((role) => /^\d+$/.test(role)) || (owner && /^\d+$/.test(owner))) {
      throw new Error('GATE9_RAW_ROLE_IDENTIFIER_IN_STABLE_FINGERPRINT');
    }
  }
}
