import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'release', 'import');
const DEFAULT_FOLDER = 'C:\\Users\\molte\\Downloads\\grc_import_ready_pack_after_review_PATCH20_FIXED';
const DEFAULT_USERS_FILE = '04_users_owners.csv';
const VALID_ROLES = new Set([
  'super_admin',
  'executive',
  'governance_admin',
  'division_head',
  'department_manager',
  'project_owner',
  'milestone_owner',
  'task_owner',
  'auditor',
  'compliance_officer',
  'viewer',
  'employee',
]);
const ROLE_ALIASES = new Map([
  ['super admin', 'super_admin'],
  ['governance admin', 'governance_admin'],
  ['division head', 'division_head'],
  ['department manager', 'department_manager'],
  ['quality manager', 'department_manager'],
  ['risk manager', 'compliance_officer'],
  ['compliance officer', 'compliance_officer'],
  ['internal auditor', 'auditor'],
  ['project owner', 'project_owner'],
  ['milestone owner', 'milestone_owner'],
  ['task owner', 'task_owner'],
]);
const ROLE_RANK = {
  employee: 10,
  viewer: 20,
  task_owner: 30,
  milestone_owner: 40,
  project_owner: 50,
  auditor: 60,
  compliance_officer: 65,
  department_manager: 70,
  division_head: 80,
  executive: 90,
  governance_admin: 100,
  super_admin: 110,
};
const PROTECTED_HIGH_ROLES = new Set(['super_admin', 'governance_admin', 'executive', 'division_head']);
const ACTIVE_STATUSES = new Set(['active', 'invited']);
const STATUS_ALIASES = new Map([
  ['active', 'active'],
  ['yes', 'active'],
  ['true', 'active'],
  ['1', 'active'],
  ['inactive', 'inactive'],
  ['no', 'inactive'],
  ['false', 'inactive'],
  ['0', 'inactive'],
  ['archived', 'archived'],
  ['retired', 'archived'],
  ['locked', 'locked'],
  ['pending', 'invited'],
  ['pending setup', 'invited'],
  ['invited', 'invited'],
]);
const SENSITIVE_HEADER_PATTERN = /(salary|bank|iban|iqama|deduction|allowance|nationality|payroll_amount|basic_pay|housing|transport)/i;

function parseArgs(argv) {
  const options = {
    folder: DEFAULT_FOLDER,
    organizationId: null,
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const readValue = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value.`);
      index += 1;
      return value;
    };
    if (arg === '--folder') options.folder = readValue();
    else if (arg === '--organization-id') options.organizationId = readValue();
    else if (arg === '--dry-run') options.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.organizationId || !/^[0-9a-f-]{36}$/i.test(options.organizationId)) {
    throw new Error('--organization-id must be a real organization UUID.');
  }
  return options;
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeHeader(value) {
  return normalizeText(value)
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
}

function valueFor(row, aliases) {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    if (Object.prototype.hasOwnProperty.call(row, key) && normalizeText(row[key])) return normalizeText(row[key]);
  }
  return '';
}

function csvEscape(value) {
  const text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(fileName, rows, headers = null) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const effectiveHeaders = headers ?? Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const body = rows.map(row => effectiveHeaders.map(header => csvEscape(row[header])).join(','));
  fs.writeFileSync(path.join(REPORT_DIR, fileName), [effectiveHeaders.join(','), ...body].join('\n'), 'utf8');
}

function writeJson(fileName, value) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseCsv(text) {
  const cleanText = text.replace(/^\uFEFF/, '');
  const rows = [];
  let current = '';
  let row = [];
  let quoted = false;
  for (let index = 0; index < cleanText.length; index += 1) {
    const char = cleanText[index];
    const next = cleanText[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(current);
      current = '';
    } else if (char === '\n') {
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
    } else if (char !== '\r') current += char;
  }
  row.push(current);
  if (row.length > 1 || normalizeText(row[0])) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).filter(values => values.some(value => normalizeText(value))).map((values, index) => {
    const record = { __rowNumber: index + 2 };
    headers.forEach((header, headerIndex) => {
      if (!SENSITIVE_HEADER_PATTERN.test(header)) record[header] = normalizeText(values[headerIndex]);
    });
    return record;
  });
}

function roleToAppRole(value) {
  const raw = normalizeText(value);
  const normalized = normalizeHeader(raw);
  if (VALID_ROLES.has(normalized)) return normalized;
  return ROLE_ALIASES.get(raw.toLowerCase()) ?? null;
}

function statusToUserStatus(value) {
  return STATUS_ALIASES.get(normalizeKey(value || 'active')) ?? 'active';
}

function isGeneratedEmail(value) {
  return /(@local\.test|@example\.|generated|synthetic|placeholder|noemail|unknown)/i.test(normalizeKey(value));
}

function scopeForRole(role, departmentId) {
  if (['super_admin', 'executive', 'governance_admin'].includes(role)) return 'global';
  return departmentId ? 'department' : 'assigned_only';
}

function roleRank(role) {
  return ROLE_RANK[role] ?? 0;
}

function shouldPreserveHigherRole(existingRoles, requestedRole) {
  const requestedRank = roleRank(requestedRole);
  return existingRoles.some(role => role.is_active
    && PROTECTED_HIGH_ROLES.has(role.role)
    && roleRank(role.role) > requestedRank);
}

function supabaseEnv() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.API_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SECRET_KEY,
  };
}

function serviceClient() {
  const { url, key } = supabaseEnv();
  if (!url || !key) {
    throw new Error('Backfill requires SUPABASE_URL/VITE_SUPABASE_URL/API_URL plus SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY in the CLI environment.');
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function columnExists(client, table, column) {
  const { error } = await client.from(table).select(column, { count: 'exact', head: true }).limit(1);
  return !error;
}

async function loadProfileColumns(client) {
  const optional = ['department_code', 'department_name', 'user_status', 'user_type', 'last_reviewed_at'];
  const entries = await Promise.all(optional.map(async column => [column, await columnExists(client, 'profiles', column)]));
  return new Map(entries);
}

async function readAll(client, table, select, queryBuilder = query => query) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const query = queryBuilder(client.from(table).select(select).range(from, from + pageSize - 1));
    const { data, error } = await query;
    if (error) throw new Error(`Unable to read ${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function loadAuthUsersByEmail(client) {
  const byEmail = new Map();
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Unable to list auth users: ${error.message}`);
    const users = data?.users ?? [];
    users.forEach(user => {
      if (user.email) byEmail.set(normalizeKey(user.email), user);
    });
    if (users.length < perPage) break;
  }
  return byEmail;
}

function indexByProfileId(rows) {
  const map = new Map();
  rows.forEach(row => {
    const userId = row.user_id;
    map.set(userId, [...(map.get(userId) ?? []), row]);
  });
  return map;
}

function nullSafeEqual(left, right) {
  return (left ?? null) === (right ?? null);
}

function findExactRole(roles, role, scope, organizationId, departmentId) {
  return roles.find(existing => existing.role === role
    && existing.scope === scope
    && nullSafeEqual(existing.organization_id, organizationId)
    && nullSafeEqual(existing.department_id, departmentId));
}

function findRepairableSameRole(roles, role) {
  return roles.find(existing => existing.role === role && (
    !existing.is_active
    || existing.scope === 'assigned_only'
    || !existing.department_id
  ));
}

function changedPatch(current, desired) {
  const patch = {};
  for (const [key, value] of Object.entries(desired)) {
    if ((current[key] ?? null) !== (value ?? null)) patch[key] = value;
  }
  return patch;
}

async function snapshot(client, organizationId, csvRows) {
  const emails = new Set(csvRows.map(row => normalizeKey(valueFor(row, ['email', 'email_address']))).filter(Boolean));
  const profiles = (await readAll(client, 'profiles', 'id,email,organization_id,department_id'))
    .filter(profile => emails.has(normalizeKey(profile.email)));
  const profileIds = profiles.map(profile => profile.id);
  const profileIdSet = new Set(profileIds);
  const roles = (await readAll(client, 'user_roles', 'id,user_id,role,scope,organization_id,department_id,is_active', query => query.eq('organization_id', organizationId)))
    .filter(role => profileIdSet.has(role.user_id));
  const rolesByUser = indexByProfileId(roles);
  const matchedProfiles = profiles.filter(profile => emails.has(normalizeKey(profile.email)));
  const inOrgProfiles = matchedProfiles.filter(profile => profile.organization_id === organizationId);
  return {
    csv_user_count: csvRows.length,
    matched_profile_count: matchedProfiles.length,
    profiles_in_organization_count: inOrgProfiles.length,
    profiles_with_department_count: inOrgProfiles.filter(profile => profile.department_id).length,
    profiles_with_active_role_count: inOrgProfiles.filter(profile => (rolesByUser.get(profile.id) ?? []).some(role => role.is_active)).length,
  };
}

async function backfill(options) {
  const client = serviceClient();
  const usersPath = path.join(options.folder, DEFAULT_USERS_FILE);
  if (!fs.existsSync(usersPath)) throw new Error(`Users CSV not found: ${usersPath}`);
  const rows = parseCsv(fs.readFileSync(usersPath, 'utf8'));
  const before = await snapshot(client, options.organizationId, rows);
  const [profileColumns, departments, profiles, userRoles, authUsersByEmail] = await Promise.all([
    loadProfileColumns(client),
    readAll(client, 'departments', 'id,organization_id,code,name_en,name_ar,is_active', query => query.eq('organization_id', options.organizationId)),
    readAll(client, 'profiles', 'id,organization_id,employee_no,full_name_en,full_name_ar,email,phone,job_title,department_id,is_active'),
    readAll(client, 'user_roles', 'id,user_id,role,scope,organization_id,department_id,is_active,assigned_at'),
    loadAuthUsersByEmail(client),
  ]);
  const departmentsByCode = new Map(departments
    .filter(department => department.is_active !== false && department.code)
    .map(department => [normalizeKey(department.code), department]));
  const profilesByEmail = new Map(profiles.map(profile => [normalizeKey(profile.email), profile]));
  const rolesByUser = indexByProfileId(userRoles);
  const unmatched = [];
  const changes = {
    profiles_created: 0,
    profiles_updated: 0,
    role_rows_inserted: 0,
    role_rows_updated: 0,
    higher_roles_preserved: 0,
    already_correct_profiles: 0,
    already_correct_roles: 0,
  };

  for (const row of rows) {
    const rowNumber = row.__rowNumber;
    const email = normalizeKey(valueFor(row, ['email', 'email_address']));
    const employeeNo = valueFor(row, ['employee_no', 'employee_id', 'employee_number']);
    const fullNameEn = valueFor(row, ['full_name_en', 'name_en', 'english_name', 'name']) || email;
    const fullNameAr = valueFor(row, ['full_name_ar', 'name_ar', 'arabic_name']) || null;
    const jobTitle = valueFor(row, ['job_title', 'title']) || null;
    const phone = valueFor(row, ['phone', 'mobile']) || null;
    const departmentCode = valueFor(row, ['department_code', 'dept_code']);
    const requestedRole = roleToAppRole(valueFor(row, ['role', 'role_name', 'primary_role', 'requested_role']));
    const status = statusToUserStatus(valueFor(row, ['status', 'user_status']));
    const active = ACTIVE_STATUSES.has(status);
    if (!email) {
      unmatched.push({ row_number: rowNumber, email, employee_no: employeeNo, department_code: departmentCode, issue: 'missing_email', detail: 'CSV row has no email.' });
      continue;
    }

    const department = departmentCode ? departmentsByCode.get(normalizeKey(departmentCode)) : null;
    if (departmentCode && !department) {
      unmatched.push({ row_number: rowNumber, email, employee_no: employeeNo, department_code: departmentCode, issue: 'unmatched_department', detail: 'No active public.departments row matched department_code for this organization.' });
    }

    let profile = profilesByEmail.get(email);
    if (profile?.organization_id && profile.organization_id !== options.organizationId) {
      unmatched.push({ row_number: rowNumber, email, employee_no: employeeNo, department_code: departmentCode, issue: 'profile_cross_org', detail: `Profile belongs to organization ${profile.organization_id}.` });
      continue;
    }

    if (!profile) {
      const authUser = authUsersByEmail.get(email);
      if (!authUser) {
        unmatched.push({
          row_number: rowNumber,
          email,
          employee_no: employeeNo,
          department_code: departmentCode,
          issue: 'unmatched_user',
          detail: isGeneratedEmail(email) ? 'No auth/profile account matched generated email.' : 'No auth/profile account matched email.',
        });
        continue;
      }
      const payload = {
        id: authUser.id,
        organization_id: options.organizationId,
        email,
        employee_no: employeeNo || null,
        full_name_en: fullNameEn,
        full_name_ar: fullNameAr,
        phone,
        job_title: jobTitle,
        department_id: department?.id ?? null,
        is_active: active,
      };
      if (profileColumns.get('department_code')) payload.department_code = department?.code ?? (departmentCode || null);
      if (profileColumns.get('department_name')) payload.department_name = department?.name_en ?? null;
      if (profileColumns.get('user_status')) payload.user_status = status;
      if (profileColumns.get('user_type')) payload.user_type = valueFor(row, ['user_type', 'type']) || 'employee';
      if (profileColumns.get('last_reviewed_at')) payload.last_reviewed_at = new Date().toISOString();
      if (!options.dryRun) {
        const { data, error } = await client.from('profiles').insert(payload).select('*').maybeSingle();
        if (error) {
          unmatched.push({ row_number: rowNumber, email, employee_no: employeeNo, department_code: departmentCode, issue: 'profile_create_failed', detail: error.message });
          continue;
        }
        profile = data;
      } else {
        profile = payload;
      }
      profilesByEmail.set(email, profile);
      rolesByUser.set(profile.id, []);
      changes.profiles_created += 1;
    }

    const desiredProfile = {
      organization_id: options.organizationId,
      employee_no: employeeNo || null,
      full_name_en: fullNameEn,
      full_name_ar: fullNameAr,
      phone,
      job_title: jobTitle,
      department_id: department?.id ?? profile.department_id ?? null,
      is_active: active,
    };
    if (profileColumns.get('department_code')) desiredProfile.department_code = department?.code ?? (departmentCode || null);
    if (profileColumns.get('department_name')) desiredProfile.department_name = department?.name_en ?? null;
    if (profileColumns.get('user_status')) desiredProfile.user_status = status;
    if (profileColumns.get('user_type')) desiredProfile.user_type = valueFor(row, ['user_type', 'type']) || 'employee';
    if (profileColumns.get('last_reviewed_at')) desiredProfile.last_reviewed_at = new Date().toISOString();

    const patch = changedPatch(profile, desiredProfile);
    if (Object.keys(patch).length) {
      if (!options.dryRun) {
        const { data, error } = await client.from('profiles').update(patch).eq('id', profile.id).select('*').maybeSingle();
        if (error) {
          unmatched.push({ row_number: rowNumber, email, employee_no: employeeNo, department_code: departmentCode, issue: 'profile_update_failed', detail: error.message });
          continue;
        }
        profile = data ?? { ...profile, ...patch };
      } else {
        profile = { ...profile, ...patch };
      }
      profilesByEmail.set(email, profile);
      changes.profiles_updated += 1;
    } else {
      changes.already_correct_profiles += 1;
    }

    if (!requestedRole) {
      unmatched.push({ row_number: rowNumber, email, employee_no: employeeNo, department_code: departmentCode, issue: 'invalid_or_missing_role', detail: 'CSV role could not be normalized to app_role.' });
      continue;
    }
    if (!active) {
      unmatched.push({ row_number: rowNumber, email, employee_no: employeeNo, department_code: departmentCode, issue: 'role_skipped_inactive_status', detail: `CSV status ${status} is not active/invited.` });
      continue;
    }

    const currentRoles = rolesByUser.get(profile.id) ?? [];
    if (shouldPreserveHigherRole(currentRoles, requestedRole)) {
      changes.higher_roles_preserved += 1;
      continue;
    }

    const roleDepartmentId = department?.id ?? null;
    const scope = scopeForRole(requestedRole, roleDepartmentId);
    const effectiveDepartmentId = scope === 'department' ? roleDepartmentId : null;
    const exactRole = findExactRole(currentRoles, requestedRole, scope, options.organizationId, effectiveDepartmentId);
    if (exactRole?.is_active) {
      changes.already_correct_roles += 1;
      continue;
    }

    const repairable = exactRole ?? findRepairableSameRole(currentRoles, requestedRole);
    if (repairable) {
      const rolePatch = {
        scope,
        organization_id: options.organizationId,
        division_id: null,
        department_id: effectiveDepartmentId,
        unit_id: null,
        is_active: true,
      };
      if (!options.dryRun) {
        const { data, error } = await client.from('user_roles').update(rolePatch).eq('id', repairable.id).select('*').maybeSingle();
        if (error) {
          unmatched.push({ row_number: rowNumber, email, employee_no: employeeNo, department_code: departmentCode, issue: 'role_update_failed', detail: error.message });
          continue;
        }
        const updatedRole = data ?? { ...repairable, ...rolePatch };
        rolesByUser.set(profile.id, currentRoles.map(role => role.id === repairable.id ? updatedRole : role));
      }
      changes.role_rows_updated += 1;
      continue;
    }

    const rolePayload = {
      user_id: profile.id,
      role: requestedRole,
      scope,
      organization_id: options.organizationId,
      division_id: null,
      department_id: effectiveDepartmentId,
      unit_id: null,
      is_active: true,
    };
    if (!options.dryRun) {
      const { data, error } = await client.from('user_roles').insert(rolePayload).select('*').maybeSingle();
      if (error) {
        unmatched.push({ row_number: rowNumber, email, employee_no: employeeNo, department_code: departmentCode, issue: 'role_insert_failed', detail: error.message });
        continue;
      }
      rolesByUser.set(profile.id, [...currentRoles, data ?? rolePayload]);
    }
    changes.role_rows_inserted += 1;
  }

  const after = await snapshot(client, options.organizationId, rows);
  const unmatchedHeaders = ['row_number', 'email', 'employee_no', 'department_code', 'issue', 'detail'];
  writeCsv('patch20-user-assignment-backfill-unmatched.csv', unmatched, unmatchedHeaders);
  const unmatchedUsers = unmatched.filter(row => ['unmatched_user', 'missing_email', 'profile_cross_org', 'profile_create_failed', 'profile_update_failed'].includes(row.issue)).length;
  const unmatchedDepartments = unmatched.filter(row => row.issue === 'unmatched_department').length;
  const summary = {
    generated_at: new Date().toISOString(),
    mode: options.dryRun ? 'dry_run' : 'apply',
    organization_id: options.organizationId,
    folder: options.folder,
    source_file: usersPath,
    before,
    after,
    changes,
    unmatched_count: unmatched.length,
    unmatched_users: unmatchedUsers,
    unmatched_departments: unmatchedDepartments,
    unmatched_report: 'release/import/patch20-user-assignment-backfill-unmatched.csv',
    safety: {
      hard_delete_used: false,
      auth_users_created: false,
      sensitive_fields_touched: false,
      service_role_browser_usage: false,
      higher_admin_roles_preserved: true,
    },
  };
  writeJson('patch20-user-assignment-backfill-summary.json', summary);
  return summary;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const summary = await backfill(options);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(error => {
  const summary = {
    generated_at: new Date().toISOString(),
    mode: 'failed',
    error: error instanceof Error ? error.message : String(error),
  };
  writeJson('patch20-user-assignment-backfill-summary.json', summary);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
