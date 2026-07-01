import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const DEFAULT_FOLDER = 'C:\\Users\\molte\\Downloads\\grc_import_ready_pack_after_review';
const REPORT_DIR = path.join(ROOT, 'release', 'import');
const SENSITIVE_FIELD_PATTERNS = [
  /salary/i,
  /bank/i,
  /iban/i,
  /iqama/i,
  /deduction/i,
  /allowance/i,
  /nationality/i,
  /payroll_amount/i,
  /basic_pay/i,
  /housing/i,
  /transport/i,
];
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
  ['executive', 'executive'],
  ['governance admin', 'governance_admin'],
  ['quality manager', 'department_manager'],
  ['risk manager', 'compliance_officer'],
  ['compliance officer', 'compliance_officer'],
  ['internal auditor', 'auditor'],
  ['auditor', 'auditor'],
  ['department manager', 'department_manager'],
  ['employee', 'employee'],
  ['viewer', 'viewer'],
]);
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
const WORKFLOW_STATUS_VALUES = new Set([
  'approved',
  'accepted',
  'closed',
  'complete',
  'completed',
  'conditional_go',
  'deferred',
  'draft',
  'expired',
  'failed',
  'go',
  'in_progress',
  'loaded',
  'metadata_only',
  'no_go',
  'not_applicable',
  'not_started',
  'open',
  'passed',
  'pending_review',
  'planned',
  'ready',
  'rejected',
  'resolved',
  'signed_off',
  'under_review',
  'validated',
]);
const DATE_HEADER_PATTERN = /(date|_at$|deadline|due|effective|expiry|retirement|planned)/i;
const COPYRIGHT_TEXT_HEADERS = /(standard_text|requirement_text|clause_text|full_text|copyright|verbatim|description|summary)/i;
const LONG_STANDARD_TEXT_LIMIT = 700;
const EXPECTED_FILES = [
  {
    key: 'departments',
    file: '01_departments.csv',
    label: 'Departments',
    targetTable: 'departments, real_department_master',
    businessKeyAliases: ['department_code', 'code', 'dept_code'],
    required: [
      ['department_code', 'code', 'dept_code'],
      ['department_name_en', 'name_en', 'department_name', 'name'],
    ],
  },
  {
    key: 'committees',
    file: '02_committees.csv',
    label: 'Committees',
    targetTable: 'real_committee_master',
    businessKeyAliases: ['committee_code', 'code'],
    required: [
      ['committee_code', 'code'],
      ['committee_name', 'name', 'committee_name_en'],
    ],
  },
  {
    key: 'role_matrix',
    file: '03_role_matrix.csv',
    label: 'Role matrix',
    targetTable: 'real_role_matrix, user_roles',
    businessKeyAliases: ['role_code', 'role_name', 'role'],
    required: [
      ['role_name', 'role', 'app_role'],
      ['module_key', 'module', 'area'],
    ],
  },
  {
    key: 'users',
    file: '04_users_owners.csv',
    label: 'Users and owners',
    targetTable: 'profiles, patch20_pending_auth_users',
    businessKeyAliases: ['email', 'email_address'],
    required: [
      ['email', 'email_address'],
      ['full_name_en', 'name_en', 'english_name', 'name'],
    ],
  },
  {
    key: 'evidence_taxonomy',
    file: '05_evidence_taxonomy.csv',
    label: 'Evidence taxonomy',
    targetTable: 'real_evidence_taxonomy',
    businessKeyAliases: ['taxonomy_code', 'evidence_code', 'code'],
    required: [
      ['taxonomy_code', 'evidence_code', 'code'],
      ['taxonomy_name', 'evidence_name', 'name'],
    ],
  },
  {
    key: 'control_library',
    file: '06_control_library.csv',
    label: 'Control library',
    targetTable: 'real_control_library',
    businessKeyAliases: ['control_code', 'code'],
    required: [
      ['control_code', 'code'],
      ['control_name', 'title', 'name'],
    ],
  },
  {
    key: 'kpi_indicators',
    file: '07_kpi_indicators.csv',
    label: 'KPI indicators',
    targetTable: 'real_indicator_catalog',
    businessKeyAliases: ['indicator_code', 'kpi_code', 'code'],
    required: [
      ['indicator_code', 'kpi_code', 'code'],
      ['indicator_name', 'kpi_name', 'name'],
    ],
  },
  {
    key: 'tracer_templates',
    file: '08_tracer_templates.csv',
    label: 'Tracer templates',
    targetTable: 'real_tracer_templates',
    businessKeyAliases: ['tracer_code', 'template_code', 'code'],
    required: [
      ['tracer_code', 'template_code', 'code'],
      ['tracer_name', 'template_name', 'name'],
    ],
  },
  {
    key: 'audit_universe',
    file: '09_audit_universe.csv',
    label: 'Audit universe',
    targetTable: 'patch20_real_import_rows',
    businessKeyAliases: ['audit_code', 'auditable_entity_code', 'code'],
    required: [
      ['audit_code', 'auditable_entity_code', 'code'],
      ['audit_area', 'auditable_entity', 'title', 'name'],
    ],
  },
  {
    key: 'compliance_obligations',
    file: '10_compliance_obligations.csv',
    label: 'Compliance obligations',
    targetTable: 'compliance_obligations',
    businessKeyAliases: ['obligation_code', 'compliance_code', 'code'],
    required: [
      ['obligation_code', 'compliance_code', 'code'],
      ['title', 'obligation_title', 'name'],
    ],
  },
  {
    key: 'document_register',
    file: '11_document_register.csv',
    label: 'Document register',
    targetTable: 'real_document_register',
    businessKeyAliases: ['document_code', 'doc_code', 'code'],
    required: [
      ['document_code', 'doc_code', 'code'],
      ['document_title', 'title', 'name'],
    ],
  },
  {
    key: 'standards_metadata',
    file: '12_standards_metadata.csv',
    label: 'Standards metadata',
    targetTable: 'real_standard_libraries',
    businessKeyAliases: ['framework_code', 'standard_code', 'code'],
    required: [
      ['framework_code', 'standard_code', 'code'],
      ['framework_name', 'standard_name', 'name'],
    ],
  },
  {
    key: 'uat_scenarios',
    file: '13_uat_scenarios.csv',
    label: 'UAT scenarios',
    targetTable: 'patch20_real_import_rows',
    businessKeyAliases: ['scenario_code', 'uat_code', 'code'],
    required: [
      ['scenario_code', 'uat_code', 'code'],
      ['scenario_title', 'title', 'name'],
    ],
  },
  {
    key: 'go_no_go_signoffs',
    file: '14_go_no_go_signoffs.csv',
    label: 'Go/no-go signoffs',
    targetTable: 'patch20_real_import_rows',
    businessKeyAliases: ['signoff_code', 'decision_code', 'code'],
    required: [
      ['signoff_code', 'decision_code', 'code'],
      ['signoff_title', 'decision_title', 'title', 'name'],
    ],
  },
  {
    key: 'payroll_department_map',
    file: '15_payroll_department_map.csv',
    label: 'Payroll department map',
    targetTable: 'patch20_real_import_rows',
    businessKeyAliases: ['payroll_department_code', 'department_code', 'code'],
    required: [
      ['payroll_department_code', 'department_code', 'code'],
      ['department_name', 'payroll_department_name', 'name'],
    ],
  },
];

function parseArgs(argv) {
  const options = {
    mode: 'dry-run',
    folder: DEFAULT_FOLDER,
    organizationId: null,
    createAuthUsers: false,
    skipAuthUserCreation: false,
    limit: null,
    confirmProduction: false,
  };

  const readValue = (index, flag) => {
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.mode = 'dry-run';
    else if (arg === '--apply') options.mode = 'apply';
    else if (arg === '--folder') {
      options.folder = readValue(index, arg);
      index += 1;
    } else if (arg === '--organization-id') {
      options.organizationId = readValue(index, arg);
      index += 1;
    } else if (arg === '--create-auth-users') {
      const value = readValue(index, arg).toLowerCase();
      if (!['true', 'false'].includes(value)) throw new Error('--create-auth-users must be true or false.');
      options.createAuthUsers = value === 'true';
      index += 1;
    }
    else if (arg === '--skip-auth-user-creation') {
      options.skipAuthUserCreation = true;
      options.createAuthUsers = false;
    } else if (arg === '--limit') {
      options.limit = Number(readValue(index, arg));
      if (!Number.isFinite(options.limit) || options.limit < 1) throw new Error('--limit must be a positive number.');
      index += 1;
    }
    else if (arg === '--confirm-production') options.confirmProduction = true;
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (options.organizationId) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(options.organizationId)) {
      throw new Error('--organization-id must be a real organization UUID. In PowerShell, set $env:GRC_ORGANIZATION_ID = "your-real-uuid" and pass --organization-id "$env:GRC_ORGANIZATION_ID".');
    }
  }
  return options;
}

function ensureReportDir() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function csvEscape(value) {
  const text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(fileName, rows, headers = null) {
  const effectiveHeaders = headers ?? Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const body = rows.map(row => effectiveHeaders.map(header => csvEscape(row[header])).join(','));
  fs.writeFileSync(path.join(REPORT_DIR, fileName), [effectiveHeaders.join(','), ...body].join('\n'), 'utf8');
}

function writeJson(fileName, value) {
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
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(current);
      if (row.some(value => normalizeText(value))) rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }
  row.push(current);
  if (row.some(value => normalizeText(value))) rows.push(row);
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map(normalizeHeader);
  const records = rows.slice(1).map((values, index) => {
    const record = { __rowNumber: index + 2 };
    headers.forEach((header, headerIndex) => {
      record[header] = normalizeText(values[headerIndex] ?? '');
    });
    return record;
  });
  return { headers, records };
}

function findHeader(headers, aliases) {
  return aliases.map(normalizeHeader).find(alias => headers.includes(alias)) ?? null;
}

function valueFor(row, aliases) {
  const key = Object.keys(row).find(header => aliases.map(normalizeHeader).includes(header));
  return key ? normalizeText(row[key]) : '';
}

function hasSensitiveHeader(header) {
  return SENSITIVE_FIELD_PATTERNS.some(pattern => pattern.test(header));
}

function sanitizeRow(row) {
  const sanitized = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith('__')) continue;
    if (hasSensitiveHeader(key)) continue;
    sanitized[key] = value;
  }
  return sanitized;
}

function roleToAppRole(value) {
  const normalized = normalizeKey(value).replaceAll('_', ' ');
  if (!normalized) return '';
  if (VALID_ROLES.has(normalizeHeader(value))) return normalizeHeader(value);
  return ROLE_ALIASES.get(normalized) ?? '';
}

function statusToAppStatus(value) {
  const normalized = normalizeKey(value).replaceAll('_', ' ');
  if (!normalized) return '';
  return STATUS_ALIASES.get(normalized) ?? '';
}

function statusActivePatch(row) {
  const rawStatus = valueFor(row, ['status', 'is_active', 'record_status', 'profile_status', 'user_status']);
  const mapped = statusToAppStatus(rawStatus);
  if (!mapped) return {};
  return { is_active: !['inactive', 'archived', 'locked'].includes(mapped) };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeText(value));
}

function isGeneratedEmail(value) {
  const email = normalizeKey(value);
  return /(@local\.test|@example\.|generated|synthetic|placeholder|noemail|unknown)/i.test(email);
}

function isValidDate(value) {
  if (!normalizeText(value)) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value);
}

function businessKeyFor(config, row) {
  return valueFor(row, config.businessKeyAliases);
}

function hashRow(row) {
  return crypto.createHash('sha256').update(JSON.stringify(sanitizeRow(row))).digest('hex');
}

function importPlan() {
  return EXPECTED_FILES.map((config, index) => ({
    order: index + 1,
    file: config.file,
    dataset_key: config.key,
    label: config.label,
    target_table: config.targetTable,
    dependency_note: index === 0
      ? 'Departments first so every later file can validate references.'
      : 'Depends on departments and previously loaded identity/reference rows.',
  }));
}

function makeIssue(type, severity, fileName, rowNumber, field, message, value = '') {
  return {
    type,
    severity,
    blocking: severity === 'error',
    file_name: fileName,
    row_number: rowNumber ?? '',
    field: field ?? '',
    message,
    value,
  };
}

function validatePack(options) {
  const folderExists = fs.existsSync(options.folder) && fs.statSync(options.folder).isDirectory();
  const files = new Map();
  const errors = [];
  const warnings = [];
  const generatedEmails = [];
  const pendingAuthUsers = [];
  const payrollDiscoveredDepartments = [];

  if (!folderExists) {
    warnings.push(makeIssue(
      'input_folder_missing',
      'warning',
      '',
      '',
      'folder',
      `Input folder was not found: ${options.folder}. This report is an environment precheck; rerun with --folder once the pack is available.`,
      options.folder,
    ));
  }

  for (const config of EXPECTED_FILES) {
    const filePath = path.join(options.folder, config.file);
    if (!folderExists || !fs.existsSync(filePath)) {
      if (folderExists) {
        errors.push(makeIssue('missing_required_file', 'error', config.file, '', 'file', `Required file is missing: ${config.file}`));
      }
      files.set(config.key, { config, headers: [], rows: [], present: false });
      continue;
    }
    const text = fs.readFileSync(filePath, 'utf8');
    const parsed = parseCsv(text);
    const rows = Number.isFinite(options.limit) && options.limit > 0 ? parsed.records.slice(0, options.limit) : parsed.records;
    files.set(config.key, { config, headers: parsed.headers, rows, present: true });
    for (const group of config.required) {
      if (!findHeader(parsed.headers, group)) {
        errors.push(makeIssue('missing_required_column', 'error', config.file, '', group.join('|'), `Required column is missing. Accepted names: ${group.join(', ')}`));
      }
    }
    parsed.headers.filter(hasSensitiveHeader).forEach(header => {
      warnings.push(makeIssue('sensitive_column_excluded', 'warning', config.file, '', header, `Payroll-sensitive column "${header}" will be excluded from all imports and reports.`));
    });
  }

  const departmentRows = files.get('departments')?.rows ?? [];
  const userRows = files.get('users')?.rows ?? [];
  const committeeRows = files.get('committees')?.rows ?? [];
  const departmentCodes = new Set(departmentRows.map(row => normalizeKey(valueFor(row, ['department_code', 'code', 'dept_code']))).filter(Boolean));
  const userEmails = new Set(userRows.map(row => normalizeKey(valueFor(row, ['email', 'email_address']))).filter(Boolean));
  const committeeCodes = new Set(committeeRows.map(row => normalizeKey(valueFor(row, ['committee_code', 'code']))).filter(Boolean));

  for (const { config, rows, headers, present } of files.values()) {
    if (!present) continue;
    const businessKeys = new Map();
    const emailKeys = new Map();
    rows.forEach(row => {
      const rowNumber = row.__rowNumber;
      const businessKey = businessKeyFor(config, row);
      if (businessKey) {
        const normalized = normalizeKey(businessKey);
        if (businessKeys.has(normalized)) {
          errors.push(makeIssue('duplicate_code', 'error', config.file, rowNumber, 'business_key', `Duplicate business key/code also appears on row ${businessKeys.get(normalized)}.`, businessKey));
        } else {
          businessKeys.set(normalized, rowNumber);
        }
      }
      for (const header of headers) {
        const value = row[header];
        if (DATE_HEADER_PATTERN.test(header) && value && !isValidDate(value)) {
          errors.push(makeIssue('invalid_date', 'error', config.file, rowNumber, header, 'Date must be YYYY-MM-DD or DD/MM/YYYY.', value));
        }
        if (config.key === 'standards_metadata' && COPYRIGHT_TEXT_HEADERS.test(header) && normalizeText(value).length > LONG_STANDARD_TEXT_LIMIT) {
          errors.push(makeIssue('copyright_text_risk', 'error', config.file, rowNumber, header, 'Long standards text detected. Load only licensed metadata/references, not copyrighted standard text.', `${normalizeText(value).slice(0, 120)}...`));
        }
      }
      const status = valueFor(row, ['status', 'is_active', 'record_status', 'approval_status']);
      const normalizedStatus = normalizeHeader(status);
      const mappedStatus = statusToAppStatus(status);
      if (status && !mappedStatus && !WORKFLOW_STATUS_VALUES.has(normalizedStatus)) {
        errors.push(makeIssue('invalid_status', 'error', config.file, rowNumber, 'status', 'Status value is not recognized.', status));
      }
      if (['inactive', 'archived', 'locked'].includes(mappedStatus)) {
        warnings.push(makeIssue(
          'explicit_inactive_status',
          'warning',
          config.file,
          rowNumber,
          'status',
          'CSV explicitly marks this record inactive, archived, or locked. Apply mode may update workflow participation status.',
          status,
        ));
      }
      const role = valueFor(row, ['role', 'role_name', 'app_role', 'primary_role', 'requested_role']);
      if (role && !roleToAppRole(role)) {
        errors.push(makeIssue('invalid_role', 'error', config.file, rowNumber, 'role', 'Role does not map to a platform AppRole.', role));
      }
      const email = valueFor(row, ['email', 'email_address', 'owner_email', 'manager_email', 'chair_email']);
      if (email) {
        const normalizedEmail = normalizeKey(email);
        if (!isValidEmail(email)) errors.push(makeIssue('invalid_email', 'error', config.file, rowNumber, 'email', 'Email format is invalid.', email));
        if (emailKeys.has(normalizedEmail)) {
          errors.push(makeIssue('duplicate_email', 'error', config.file, rowNumber, 'email', `Duplicate email also appears on row ${emailKeys.get(normalizedEmail)}.`, email));
        } else {
          emailKeys.set(normalizedEmail, rowNumber);
        }
        if (isGeneratedEmail(email)) {
          const entry = {
            file_name: config.file,
            row_number: rowNumber,
            email,
            name: valueFor(row, ['full_name_en', 'name', 'owner_name', 'manager_name']),
            review_reason: 'Generated/synthetic-looking email must be approved before invitations or auth-user creation.',
          };
          generatedEmails.push(entry);
          warnings.push(makeIssue('generated_email_review', 'warning', config.file, rowNumber, 'email', entry.review_reason, email));
        }
      }
      const departmentRef = valueFor(row, ['department_code', 'dept_code', 'owner_department_code', 'responsible_department_code']);
      if (departmentRef && config.key !== 'departments' && !departmentCodes.has(normalizeKey(departmentRef))) {
        warnings.push(makeIssue('department_reference_not_in_pack', 'warning', config.file, rowNumber, 'department_code', 'Department reference is not in 01_departments.csv. It may exist already or need review.', departmentRef));
      }
      const userRef = valueFor(row, ['owner_email', 'manager_email', 'approver_email', 'chair_email']);
      if (userRef && !userEmails.has(normalizeKey(userRef))) {
        warnings.push(makeIssue('user_reference_not_in_pack', 'warning', config.file, rowNumber, 'owner_email', 'User reference is not in 04_users_owners.csv. It may exist already or need review.', userRef));
      }
      const committeeRef = valueFor(row, ['committee_code']);
      if (committeeRef && config.key !== 'committees' && !committeeCodes.has(normalizeKey(committeeRef))) {
        warnings.push(makeIssue('committee_reference_not_in_pack', 'warning', config.file, rowNumber, 'committee_code', 'Committee reference is not in 02_committees.csv. It may exist already or need review.', committeeRef));
      }
      if (config.key === 'users' && email) {
        pendingAuthUsers.push({
          file_name: config.file,
          row_number: rowNumber,
          email,
          employee_no: valueFor(row, ['employee_no', 'employee_id', 'employee_number']),
          full_name_en: valueFor(row, ['full_name_en', 'name_en', 'english_name', 'name']),
          department_code: departmentRef,
          requested_role: roleToAppRole(role) || role,
          default_action: 'pending_account_creation_unless_existing_auth_profile_matches',
        });
      }
    });
  }

  const payrollRows = files.get('payroll_department_map')?.rows ?? [];
  payrollRows.forEach(row => {
    const departmentCode = valueFor(row, ['department_code', 'payroll_department_code', 'code']);
    const departmentName = valueFor(row, ['department_name', 'payroll_department_name', 'name']);
    if (departmentCode && !departmentCodes.has(normalizeKey(departmentCode))) {
      payrollDiscoveredDepartments.push({
        file_name: '15_payroll_department_map.csv',
        row_number: row.__rowNumber,
        department_code: departmentCode,
        department_name: departmentName,
        review_action: 'Review before creating department. Payroll-sensitive fields are excluded.',
      });
    }
  });

  const fileSummaries = Array.from(files.values()).map(({ config, rows, headers, present }) => ({
    file: config.file,
    dataset_key: config.key,
    present,
    row_count: rows.length,
    column_count: headers.length,
    target_table: config.targetTable,
  }));
  const blockingErrorCount = errors.filter(issue => issue.blocking).length;
  const warningCount = warnings.length;
  const report = {
    generated_at: new Date().toISOString(),
    mode: 'dry_run',
    input_folder: options.folder,
    input_available: folderExists,
    environment_precheck_only: !folderExists,
    required_file_count: EXPECTED_FILES.length,
    present_file_count: fileSummaries.filter(file => file.present).length,
    total_rows: fileSummaries.reduce((sum, file) => sum + file.row_count, 0),
    blocking_error_count: blockingErrorCount,
    warning_count: warningCount,
    can_apply: folderExists && blockingErrorCount === 0,
    create_auth_users_requested: options.createAuthUsers,
    create_auth_users_effective: false,
    note: folderExists
      ? 'Dry-run validation completed without changing database data.'
      : 'Input folder was not available here. No database data changed; rerun with the reviewed CSV pack folder before apply.',
    files: fileSummaries,
  };

  return { report, files, errors, warnings, generatedEmails, pendingAuthUsers, payrollDiscoveredDepartments };
}

function writeDryRunReports(validation) {
  ensureReportDir();
  writeJson('patch20-dry-run-summary.json', validation.report);
  writeCsv('patch20-dry-run-summary.csv', validation.report.files, ['file', 'dataset_key', 'present', 'row_count', 'column_count', 'target_table']);
  writeCsv('patch20-validation-errors.csv', validation.errors, ['type', 'severity', 'blocking', 'file_name', 'row_number', 'field', 'message', 'value']);
  writeCsv('patch20-validation-warnings.csv', validation.warnings, ['type', 'severity', 'blocking', 'file_name', 'row_number', 'field', 'message', 'value']);
  writeCsv('patch20-pending-auth-users.csv', validation.pendingAuthUsers, ['file_name', 'row_number', 'email', 'employee_no', 'full_name_en', 'department_code', 'requested_role', 'default_action']);
  writeCsv('patch20-generated-email-review.csv', validation.generatedEmails, ['file_name', 'row_number', 'email', 'name', 'review_reason']);
  writeCsv('patch20-payroll-discovered-departments-review.csv', validation.payrollDiscoveredDepartments, ['file_name', 'row_number', 'department_code', 'department_name', 'review_action']);
  writeJson('patch20-import-plan.json', importPlan());
}

function supabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, anonKey, serviceRoleKey };
}

function serviceClient() {
  const { url, serviceRoleKey } = supabaseEnv();
  if (!url || !serviceRoleKey) {
    throw new Error('Apply mode requires SUPABASE_URL or VITE_SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY in the CLI environment.');
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function detectOrganization(client, requestedOrganizationId) {
  if (requestedOrganizationId) return requestedOrganizationId;
  const { data, error } = await client.from('organizations').select('id,name_en,is_active').eq('is_active', true).limit(10);
  if (error) throw new Error(`Unable to detect organization: ${error.message}`);
  if ((data ?? []).length === 1) return data[0].id;
  if (!data?.length) throw new Error('No active organization found. Pass --organization-id after creating the organization.');
  throw new Error('Multiple active organizations found. Pass --organization-id explicitly.');
}

async function countTable(client, tableName, organizationId = null) {
  let query = client.from(tableName).select('id', { count: 'exact', head: true });
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { count, error } = await query;
  return { table: tableName, count: error ? null : count, error: error?.message ?? null };
}

async function preImportSnapshot(client, organizationId) {
  const tables = [
    'departments',
    'profiles',
    'user_roles',
    'real_department_master',
    'real_committee_master',
    'real_role_matrix',
    'real_evidence_taxonomy',
    'real_control_library',
    'real_indicator_catalog',
    'real_tracer_templates',
    'real_document_register',
    'real_standard_libraries',
    'patch20_pending_auth_users',
  ];
  const counts = [];
  for (const table of tables) counts.push(await countTable(client, table, table === 'user_roles' ? null : organizationId));
  return { generated_at: new Date().toISOString(), organization_id: organizationId, counts };
}

async function createRun(client, mode, options, organizationId, validation, snapshot = null) {
  const payload = {
    organization_id: organizationId,
    mode,
    source_folder: options.folder,
    input_available: validation.report.input_available,
    create_auth_users: options.createAuthUsers,
    status: mode === 'apply' ? 'created' : validation.report.can_apply ? 'validated' : 'blocked',
    dry_run_blocking_error_count: validation.report.blocking_error_count,
    warning_count: validation.report.warning_count,
    report_paths: reportPaths(mode),
    import_plan: importPlan(),
    pre_import_snapshot: snapshot,
    rollback_note: 'Use patch20-created-records.csv and patch20-updated-records.csv to manually reverse staging changes. No hard-delete rollback is generated.',
  };
  const { data, error } = await client.from('patch20_real_import_runs').insert(payload).select('id').maybeSingle();
  if (error) return null;
  return data?.id ?? null;
}

function reportPaths(mode) {
  const common = {
    dry_run_summary_json: 'release/import/patch20-dry-run-summary.json',
    validation_errors_csv: 'release/import/patch20-validation-errors.csv',
    validation_warnings_csv: 'release/import/patch20-validation-warnings.csv',
    import_plan_json: 'release/import/patch20-import-plan.json',
  };
  if (mode !== 'apply') return common;
  return {
    ...common,
    apply_summary_json: 'release/import/patch20-apply-summary.json',
    created_records_csv: 'release/import/patch20-created-records.csv',
    updated_records_csv: 'release/import/patch20-updated-records.csv',
    skipped_records_csv: 'release/import/patch20-skipped-records.csv',
    post_import_checks_json: 'release/import/patch20-post-import-checks.json',
  };
}

async function findExisting(client, table, organizationId, field, value, fallbackMatches = []) {
  if (value) {
    const { data, error } = await client.from(table).select('*').eq('organization_id', organizationId).ilike(field, value).limit(1);
    if (!error && data?.[0]) return data[0];
  }

  for (const match of fallbackMatches) {
    const filters = Object.entries(match).filter(([, filterValue]) => normalizeText(filterValue));
    if (!filters.length) continue;
    let query = client.from(table).select('*').eq('organization_id', organizationId);
    for (const [filterField, filterValue] of filters) {
      query = query.ilike(filterField, normalizeText(filterValue));
    }
    const { data, error } = await query.limit(1);
    if (!error && data?.[0]) return data[0];
  }

  return null;
}

async function insertResultRow(client, runId, organizationId, result) {
  if (!runId) return;
  await client.from('patch20_real_import_rows').insert({
    run_id: runId,
    organization_id: organizationId,
    file_name: result.file_name,
    dataset_key: result.dataset_key,
    row_number: result.row_number || null,
    business_key: result.business_key || null,
    target_table: result.target_table || null,
    action: result.action,
    action_status: result.action_status,
    message: result.message,
    row_hash: result.row_hash || null,
    sanitized_payload: result.sanitized_payload || {},
  });
}

async function createOrUpdate(client, runId, organizationId, resultRows, config, row, table, field, payload, fallbackMatches = []) {
  const businessKey = businessKeyFor(config, row);
  const existing = await findExisting(client, table, organizationId, field, businessKey, fallbackMatches);
  const base = {
    file_name: config.file,
    dataset_key: config.key,
    row_number: row.__rowNumber,
    business_key: businessKey,
    target_table: table,
    row_hash: hashRow(row),
    sanitized_payload: sanitizeRow(row),
  };
  if (existing) {
    const { error } = await client.from(table).update(payload).eq('id', existing.id);
    const result = { ...base, action: 'update', action_status: error ? 'failed' : 'success', message: error?.message ?? 'Updated existing record by stable business key.' };
    resultRows.push(result);
    await insertResultRow(client, runId, organizationId, result);
    return result;
  }
  const { error } = await client.from(table).insert({ ...payload, organization_id: organizationId });
  const result = { ...base, action: 'create', action_status: error ? 'failed' : 'success', message: error?.message ?? 'Created record by stable business key.' };
  resultRows.push(result);
  await insertResultRow(client, runId, organizationId, result);
  return result;
}

async function stageOnly(client, runId, organizationId, resultRows, config, row, message = 'Staged sanitized row for controlled follow-up import.') {
  const result = {
    file_name: config.file,
    dataset_key: config.key,
    row_number: row.__rowNumber,
    business_key: businessKeyFor(config, row),
    target_table: config.targetTable,
    action: 'stage',
    action_status: 'success',
    message,
    row_hash: hashRow(row),
    sanitized_payload: sanitizeRow(row),
  };
  resultRows.push(result);
  await insertResultRow(client, runId, organizationId, result);
}

async function findAuthUser(client, email) {
  try {
    const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return null;
    return (data?.users ?? []).find(user => normalizeKey(user.email) === normalizeKey(email)) ?? null;
  } catch {
    return null;
  }
}

async function findDepartmentByCode(client, organizationId, departmentCode) {
  if (!departmentCode) return null;
  const { data, error } = await client
    .from('departments')
    .select('id,code,name_en,name_ar')
    .eq('organization_id', organizationId)
    .ilike('code', departmentCode)
    .limit(1);
  if (error) return null;
  return data?.[0] ?? null;
}

async function findProfileForImport(client, organizationId, email, employeeNo) {
  if (email) {
    const byEmail = await client.from('profiles').select('*').eq('email', email).maybeSingle();
    if (byEmail.data) return byEmail.data;
  }
  if (employeeNo) {
    const byEmployee = await client
      .from('profiles')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('employee_no', employeeNo)
      .maybeSingle();
    if (byEmployee.data) return byEmployee.data;
  }
  return null;
}

function scopeForRole(role, departmentId) {
  if (['super_admin', 'executive', 'governance_admin'].includes(role)) return 'global';
  return departmentId ? 'department' : 'assigned_only';
}

async function upsertUserRole(client, runId, organizationId, resultRows, config, row, profileId, role, departmentId, active) {
  if (!profileId || !role) return;
  const scope = scopeForRole(role, departmentId);
  let query = client
    .from('user_roles')
    .select('id,is_active')
    .eq('user_id', profileId)
    .eq('role', role)
    .eq('scope', scope)
    .eq('organization_id', organizationId);
  query = departmentId ? query.eq('department_id', departmentId) : query.is('department_id', null);
  const existing = await query.limit(1).maybeSingle();
  const base = {
    file_name: config.file,
    dataset_key: config.key,
    row_number: row.__rowNumber,
    business_key: valueFor(row, ['email', 'email_address']) || profileId,
    target_table: 'user_roles',
    row_hash: hashRow(row),
    sanitized_payload: sanitizeRow(row),
  };

  if (existing.data) {
    const { error } = await client.from('user_roles').update({ is_active: active }).eq('id', existing.data.id);
    const result = { ...base, action: 'update', action_status: error ? 'failed' : 'success', message: error?.message ?? 'Updated existing role assignment by user, role, scope, and organization.' };
    resultRows.push(result);
    await insertResultRow(client, runId, organizationId, result);
    return;
  }

  const payload = {
    user_id: profileId,
    role,
    scope,
    organization_id: organizationId,
    department_id: scope === 'department' ? departmentId : null,
    is_active: active,
  };
  const { error } = await client.from('user_roles').insert(payload);
  const result = { ...base, action: 'create', action_status: error ? 'failed' : 'success', message: error?.message ?? 'Created role assignment by stable user/email match.' };
  resultRows.push(result);
  await insertResultRow(client, runId, organizationId, result);
}

async function applyUsers(client, runId, organizationId, resultRows, config, rows, options) {
  for (const row of rows) {
    const email = valueFor(row, ['email', 'email_address']).toLowerCase();
    const fullNameEn = valueFor(row, ['full_name_en', 'name_en', 'english_name', 'name']);
    const departmentCode = valueFor(row, ['department_code', 'dept_code']);
    const employeeNo = valueFor(row, ['employee_no', 'employee_id', 'employee_number']);
    const role = roleToAppRole(valueFor(row, ['role', 'role_name', 'primary_role', 'requested_role']));
    const department = await findDepartmentByCode(client, organizationId, departmentCode);
    const profile = await findProfileForImport(client, organizationId, email, employeeNo);
    let authUser = profile ? { id: profile.id, email: profile.email } : await findAuthUser(client, email);
    const base = {
      file_name: config.file,
      dataset_key: config.key,
      row_number: row.__rowNumber,
      business_key: email,
      target_table: 'profiles',
      row_hash: hashRow(row),
      sanitized_payload: sanitizeRow(row),
    };
    if (!authUser && options.createAuthUsers && !isGeneratedEmail(email)) {
      const password = crypto.randomBytes(24).toString('base64url');
      const created = await client.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error) {
        const result = { ...base, action: 'pending_auth_user', action_status: 'failed', message: created.error.message };
        resultRows.push(result);
        await insertResultRow(client, runId, organizationId, result);
        continue;
      }
      authUser = created.data.user;
      const createdAuthResult = { ...base, target_table: 'auth.users', action: 'create', action_status: 'success', message: 'Created Supabase Auth user with a temporary random password from CLI apply mode.' };
      resultRows.push(createdAuthResult);
      await insertResultRow(client, runId, organizationId, createdAuthResult);
    }
    if (!profile && !authUser) {
      await client.from('patch20_pending_auth_users').upsert({
        run_id: runId,
        organization_id: organizationId,
        email,
        employee_no: employeeNo || null,
        full_name_en: fullNameEn || email,
        full_name_ar: valueFor(row, ['full_name_ar', 'name_ar', 'arabic_name']) || null,
        department_code: departmentCode || null,
        requested_role: role || null,
        status: 'pending_review',
      }, { onConflict: 'organization_id,email' });
      const result = { ...base, action: 'pending_auth_user', action_status: 'success', message: 'No matching auth/profile account. Added to pending account creation queue.' };
      resultRows.push(result);
      await insertResultRow(client, runId, organizationId, result);
      continue;
    }

    const activePatch = statusActivePatch(row);
    const profilePayload = {
      organization_id: organizationId,
      email,
      employee_no: employeeNo || null,
      full_name_en: fullNameEn || email,
      full_name_ar: valueFor(row, ['full_name_ar', 'name_ar', 'arabic_name']) || null,
      job_title: valueFor(row, ['job_title', 'title']) || null,
      ...activePatch,
    };
    if (departmentCode) profilePayload.department_id = department?.id ?? null;
    const activeForRole = activePatch.is_active ?? profile?.is_active ?? true;
    let result;
    let effectiveProfile = profile;
    if (profile) {
      const { data, error } = await client.from('profiles').update(profilePayload).eq('id', profile.id).select('*').maybeSingle();
      effectiveProfile = data ?? profile;
      result = { ...base, action: 'update', action_status: error ? 'failed' : 'success', message: error?.message ?? 'Updated existing profile matched by email or employee number.' };
    } else {
      const { data, error } = await client.from('profiles').insert({ id: authUser.id, ...profilePayload }).select('*').maybeSingle();
      effectiveProfile = data ?? null;
      result = { ...base, action: 'create', action_status: error ? 'failed' : 'success', message: error?.message ?? 'Created profile for an existing or explicitly created auth user.' };
    }
    resultRows.push(result);
    await insertResultRow(client, runId, organizationId, result);
    if (effectiveProfile?.id && role) {
      await upsertUserRole(client, runId, organizationId, resultRows, config, row, effectiveProfile.id, role, department?.id ?? null, activeForRole);
    }
  }
}

async function applyDataset(client, runId, organizationId, resultRows, config, rows, options) {
  if (config.key === 'departments') {
    for (const row of rows) {
      const code = businessKeyFor(config, row);
      const name = valueFor(row, ['department_name_en', 'name_en', 'department_name', 'name']);
      const nameAr = valueFor(row, ['department_name_ar', 'name_ar', 'arabic_name']) || null;
      await createOrUpdate(client, runId, organizationId, resultRows, config, row, 'departments', 'code', {
        code,
        name_en: name,
        name_ar: nameAr,
        ...statusActivePatch(row),
      }, [
        { name_en: name },
        { name_ar: nameAr },
      ]);
      await createOrUpdate(client, runId, organizationId, resultRows, config, row, 'real_department_master', 'department_code', {
        department_code: code,
        department_name: name,
        department_name_ar: nameAr,
        ...statusActivePatch(row),
      }, [
        { department_name: name },
        { department_name_ar: nameAr },
      ]);
    }
    return;
  }
  if (config.key === 'users') return applyUsers(client, runId, organizationId, resultRows, config, rows, options);
  const upsertConfigs = {
    committees: ['real_committee_master', 'committee_code', row => ({ committee_code: businessKeyFor(config, row), committee_name: valueFor(row, ['committee_name', 'name', 'committee_name_en']), ...statusActivePatch(row) })],
    role_matrix: ['real_role_matrix', 'role_code', row => ({ role_code: businessKeyFor(config, row), role_name: valueFor(row, ['role_name', 'role', 'app_role']), module_key: valueFor(row, ['module_key', 'module', 'area']) || 'grc', ...statusActivePatch(row) })],
    evidence_taxonomy: ['real_evidence_taxonomy', 'taxonomy_code', row => ({ taxonomy_code: businessKeyFor(config, row), taxonomy_name: valueFor(row, ['taxonomy_name', 'evidence_name', 'name']), owner_department_code: valueFor(row, ['owner_department_code', 'department_code']) || null, ...statusActivePatch(row) })],
    control_library: ['real_control_library', 'control_code', row => ({ control_code: businessKeyFor(config, row), control_name: valueFor(row, ['control_name', 'title', 'name']), owner_department_code: valueFor(row, ['owner_department_code', 'department_code']) || null, evidence_taxonomy_code: valueFor(row, ['evidence_taxonomy_code', 'taxonomy_code']) || null, ...statusActivePatch(row) })],
    kpi_indicators: ['real_indicator_catalog', 'indicator_code', row => ({ indicator_code: businessKeyFor(config, row), indicator_name: valueFor(row, ['indicator_name', 'kpi_name', 'name']), owner_department_code: valueFor(row, ['owner_department_code', 'department_code']) || null, ...statusActivePatch(row) })],
    tracer_templates: ['real_tracer_templates', 'tracer_code', row => ({ tracer_code: businessKeyFor(config, row), tracer_name: valueFor(row, ['tracer_name', 'template_name', 'name']), department_code: valueFor(row, ['department_code']) || null, linked_requirement_code: valueFor(row, ['linked_requirement_code', 'requirement_code']) || null, ...statusActivePatch(row) })],
    document_register: ['real_document_register', 'document_code', row => ({ document_code: businessKeyFor(config, row), document_title: valueFor(row, ['document_title', 'title', 'name']), owner_department_code: valueFor(row, ['owner_department_code', 'department_code']) || null, approval_status: normalizeHeader(valueFor(row, ['approval_status', 'status'])) || 'draft' })],
    standards_metadata: ['real_standard_libraries', 'framework_code', row => ({ framework_code: businessKeyFor(config, row), framework_name: valueFor(row, ['framework_name', 'standard_name', 'name']), authority_name: valueFor(row, ['authority_name', 'authority']) || null, content_load_status: 'metadata_only' })],
  };
  const upsert = upsertConfigs[config.key];
  for (const row of rows) {
    if (upsert) await createOrUpdate(client, runId, organizationId, resultRows, config, row, upsert[0], upsert[1], upsert[2](row));
    else await stageOnly(client, runId, organizationId, resultRows, config, row);
  }
}

async function applyPack(options, validation) {
  if (!validation.report.input_available) throw new Error('Apply refused: input folder is not available.');
  if (validation.report.blocking_error_count > 0) throw new Error('Apply refused: latest dry-run has blocking validation errors.');
  if (options.createAuthUsers && !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Apply refused: --create-auth-users true requires SUPABASE_SERVICE_ROLE_KEY.');
  const { url } = supabaseEnv();
  if (/prod|production/i.test(url ?? '') && !options.confirmProduction) {
    throw new Error('Apply refused: production-looking Supabase URL requires --confirm-production after staging approval.');
  }

  const client = serviceClient();
  const organizationId = await detectOrganization(client, options.organizationId);
  const snapshot = await preImportSnapshot(client, organizationId);
  ensureReportDir();
  writeJson('patch20-pre-import-snapshot.json', snapshot);
  writeCsv('patch20-pre-import-snapshot.csv', snapshot.counts, ['table', 'count', 'error']);
  const runId = await createRun(client, 'apply', options, organizationId, validation, snapshot);
  const resultRows = [];
  for (const config of EXPECTED_FILES) {
    const file = validation.files.get(config.key);
    if (!file?.present) continue;
    await applyDataset(client, runId, organizationId, resultRows, config, file.rows, options);
  }
  const postSnapshot = await preImportSnapshot(client, organizationId);
  const summary = {
    generated_at: new Date().toISOString(),
    mode: 'apply',
    organization_id: organizationId,
    run_id: runId,
    create_auth_users_requested: options.createAuthUsers,
    created_count: resultRows.filter(row => row.action === 'create' && row.action_status === 'success').length,
    updated_count: resultRows.filter(row => row.action === 'update' && row.action_status === 'success').length,
    staged_count: resultRows.filter(row => row.action === 'stage' && row.action_status === 'success').length,
    skipped_count: resultRows.filter(row => row.action === 'skip').length,
    pending_auth_user_count: resultRows.filter(row => row.action === 'pending_auth_user').length,
    failed_count: resultRows.filter(row => row.action_status === 'failed').length,
    rollback_note: 'Review created/updated reports and reverse manually from pre-import snapshot. No hard-delete rollback is generated.',
  };
  writeJson('patch20-apply-summary.json', summary);
  writeCsv('patch20-apply-summary.csv', [summary], Object.keys(summary));
  writeCsv('patch20-created-records.csv', resultRows.filter(row => row.action === 'create'));
  writeCsv('patch20-updated-records.csv', resultRows.filter(row => row.action === 'update'));
  writeCsv('patch20-skipped-records.csv', resultRows.filter(row => ['skip', 'stage'].includes(row.action)));
  writeCsv('patch20-pending-auth-users-after-apply.csv', resultRows.filter(row => row.action === 'pending_auth_user'));
  writeJson('patch20-post-import-checks.json', { generated_at: new Date().toISOString(), pre_import_snapshot: snapshot, post_import_snapshot: postSnapshot, failed_count: summary.failed_count });
  if (runId) {
    await client.from('patch20_real_import_runs').update({
      status: summary.failed_count ? 'failed' : 'applied',
      completed_at: new Date().toISOString(),
      report_paths: reportPaths('apply'),
    }).eq('id', runId);
  }
  return summary;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureReportDir();
  const validation = validatePack(options);
  writeDryRunReports(validation);
  if (options.mode === 'dry-run') {
    console.log(JSON.stringify(validation.report, null, 2));
    return;
  }
  const summary = await applyPack(options, validation);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(error => {
  ensureReportDir();
  const summary = {
    generated_at: new Date().toISOString(),
    mode: process.argv.includes('--apply') ? 'apply' : 'dry_run',
    status: 'failed',
    error: error instanceof Error ? error.message : String(error),
  };
  writeJson(process.argv.includes('--apply') ? 'patch20-apply-summary.json' : 'patch20-dry-run-summary.json', summary);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
