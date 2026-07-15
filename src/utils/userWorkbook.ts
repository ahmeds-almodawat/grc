import type { Cell, Workbook, Worksheet } from 'exceljs';
import type { AccessScope, AppRole } from '../types/domain';

const MAX_WORKBOOK_SIZE = 5 * 1024 * 1024;
const MAX_WORKBOOK_ROWS = 5000;
const MAX_HEADER_COLUMNS = 64;
const TEXT_ENTRY_ERROR = 'This value must be entered as text using the provided Excel template.';

export type UserStatus = 'active' | 'inactive' | 'archived' | 'invited' | 'locked';
export type UserType = 'employee' | 'contractor' | 'vendor' | 'external_auditor' | 'service_account';
export type UserImportAccountAction = 'create' | 'update' | 'create_or_update';
export type UserImportPlannedAction = 'update_existing_profile' | 'pending_account_creation' | 'rejected';

export const userStatusOptions: readonly UserStatus[] = ['active', 'inactive', 'archived', 'invited', 'locked'];
export const userTypeOptions: readonly UserType[] = ['employee', 'contractor', 'vendor', 'external_auditor', 'service_account'];
export const userRoleOptions: readonly AppRole[] = [
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
];
export const userImportScopeOptions: readonly AccessScope[] = ['global', 'department', 'assigned_only'];
export const userImportAccountActionOptions: readonly UserImportAccountAction[] = ['create', 'update', 'create_or_update'];

export const USER_IMPORT_COLUMNS = [
  'employee_id',
  'english_name',
  'arabic_name',
  'contact_email',
  'phone',
  'department_code',
  'job_title',
  'role',
  'role_scope',
  'status',
  'user_type',
  'account_action',
] as const;

export type UserImportColumn = typeof USER_IMPORT_COLUMNS[number];

export type ParsedUserImportRow = {
  row_number: number;
  employee_no: string;
  full_name_en: string;
  full_name_ar: string;
  contact_email: string;
  synthetic_auth_email: string;
  phone_original: string;
  phone_normalized: string | null;
  department: string;
  department_id?: string | null;
  department_name?: string | null;
  department_division_id?: string | null;
  job_title: string;
  role: string;
  role_scope: string;
  status: string;
  user_type: string;
  account_action: string;
  validation_status?: 'valid' | 'error';
  validation_errors?: string[];
  validation_warnings?: string[];
  matched_user_id?: string | null;
  matched_user_label?: string | null;
  matched_auth_user_id?: string | null;
  matched_auth_identity_label?: string | null;
  matched_provisioning_id?: string | null;
  matched_provisioning_label?: string | null;
  matched_active_role_ids?: string[];
  planned_action?: UserImportPlannedAction;
};

export type UserImportValidationResult = {
  rows: ParsedUserImportRow[];
  rowCount: number;
  validCount: number;
  invalidCount: number;
  duplicateEmployeeIdCount: number;
  duplicateContactEmailCount: number;
  unknownDepartmentCount: number;
  unknownRoleCount: number;
  invalidPhoneCount: number;
  existingUserUpdateCount: number;
  pendingAccountCreationCount: number;
};

export interface UserWorkbookFile {
  name: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface UserWorkbookParseResult {
  headers: string[];
  rows: ParsedUserImportRow[];
  errorsByRow: Record<number, string[]>;
}

export class UserWorkbookError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'UserWorkbookError';
  }
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s/-]+/g, '_');
}

function isFormulaCell(cell: Cell) {
  const value = cell.value;
  return Boolean(value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value));
}

function addError(errorsByRow: Record<number, string[]>, rowNumber: number, message: string) {
  errorsByRow[rowNumber] = [...(errorsByRow[rowNumber] ?? []), message];
}

function plainTextValue(
  cell: Cell,
  rowNumber: number,
  columnName: string,
  errorsByRow: Record<number, string[]>,
) {
  if (cell.value === null || cell.value === undefined) return '';
  if (isFormulaCell(cell)) {
    addError(errorsByRow, rowNumber, `Formula cells are not allowed (${columnName}).`);
    return '';
  }
  if (typeof cell.value === 'string') return cell.value.trim();
  if (typeof cell.value === 'number') {
    if (columnName === 'employee_id' || columnName === 'phone') {
      addError(errorsByRow, rowNumber, `${columnName}: ${TEXT_ENTRY_ERROR}`);
    } else {
      addError(errorsByRow, rowNumber, `${columnName} must contain plain text.`);
    }
    return '';
  }
  if (
    typeof cell.value === 'object'
    && 'richText' in cell.value
    && Array.isArray(cell.value.richText)
  ) {
    return cell.value.richText.map((part) => part.text).join('').trim();
  }
  addError(errorsByRow, rowNumber, `${columnName} must contain plain text.`);
  return '';
}

function worksheetHasData(worksheet: Worksheet) {
  let hasData = false;
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.value !== null && cell.value !== undefined && (isFormulaCell(cell) || String(cell.text ?? '').trim())) {
        hasData = true;
      }
    });
  });
  return hasData;
}

async function loadWorkbook(bytes: ArrayBuffer): Promise<Workbook> {
  const { default: ExcelJS } = await import('exceljs/dist/exceljs.min.js');
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes);
  } catch {
    throw new UserWorkbookError('CORRUPT_WORKBOOK', 'The selected file is corrupt or is not a valid Excel .xlsx workbook.');
  }
  return workbook;
}

function rowFromValues(rowNumber: number, values: Partial<Record<UserImportColumn, string>>): ParsedUserImportRow {
  const employeeId = values.employee_id ?? '';
  return {
    row_number: rowNumber,
    employee_no: employeeId,
    full_name_en: values.english_name ?? '',
    full_name_ar: values.arabic_name ?? '',
    contact_email: values.contact_email ?? '',
    synthetic_auth_email: deriveSyntheticAuthEmail(employeeId),
    phone_original: values.phone ?? '',
    phone_normalized: null,
    department: values.department_code ?? '',
    job_title: values.job_title ?? '',
    role: values.role ?? '',
    role_scope: values.role_scope ?? '',
    status: values.status ?? '',
    user_type: values.user_type ?? '',
    account_action: values.account_action ?? '',
  };
}

export function deriveSyntheticAuthEmail(employeeId: string): string {
  const trimmedEmployeeId = employeeId.trim();
  return trimmedEmployeeId ? `${trimmedEmployeeId.toLowerCase()}@almodawat.sa` : '';
}

export async function parseUserWorkbook(file: UserWorkbookFile): Promise<UserWorkbookParseResult> {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.xlsx')) {
    throw new UserWorkbookError(
      'UNSUPPORTED_FILE_TYPE',
      'Unsupported file type. Upload an Excel .xlsx workbook; CSV and legacy .xls files are not accepted.',
    );
  }
  if (file.size <= 0) throw new UserWorkbookError('EMPTY_WORKBOOK', 'The selected workbook is empty.');
  if (file.size > MAX_WORKBOOK_SIZE) {
    throw new UserWorkbookError('WORKBOOK_TOO_LARGE', 'The workbook exceeds the 5 MB size limit.');
  }

  const workbook = await loadWorkbook(await file.arrayBuffer());
  const worksheet = workbook.worksheets.find((sheet) => sheet.name.trim().toLowerCase() === 'users');
  if (!worksheet) {
    throw new UserWorkbookError('USERS_WORKSHEET_REQUIRED', 'The workbook must contain exactly one worksheet named Users.');
  }
  const ambiguousSheets = workbook.worksheets.filter((sheet) => {
    const name = sheet.name.trim().toLowerCase();
    return sheet !== worksheet && name !== 'instructions' && worksheetHasData(sheet);
  });
  if (ambiguousSheets.length) {
    throw new UserWorkbookError(
      'AMBIGUOUS_DATA_SHEETS',
      `The workbook contains additional data worksheets (${ambiguousSheets.map((sheet) => sheet.name).join(', ')}). Keep user data only in Users.`,
    );
  }

  const headerColumnCount = Math.max(worksheet.getRow(1).cellCount, worksheet.actualColumnCount);
  if (!headerColumnCount) {
    throw new UserWorkbookError('MISSING_HEADERS', 'The Users worksheet does not contain a header row.');
  }
  if (headerColumnCount > MAX_HEADER_COLUMNS) {
    throw new UserWorkbookError('UNSUPPORTED_COLUMNS', 'The workbook contains too many columns.');
  }

  const errorsByRow: Record<number, string[]> = {};
  const headers: string[] = [];
  for (let columnNumber = 1; columnNumber <= headerColumnCount; columnNumber += 1) {
    headers.push(normalizeHeader(plainTextValue(
      worksheet.getRow(1).getCell(columnNumber),
      0,
      `column ${columnNumber} header`,
      errorsByRow,
    )));
  }
  if (errorsByRow[0]?.length) {
    throw new UserWorkbookError('INVALID_HEADERS', errorsByRow[0].join(' '));
  }

  const duplicateHeaders = [...new Set(headers.filter((header, index) => header && headers.indexOf(header) !== index))];
  if (duplicateHeaders.length) {
    throw new UserWorkbookError('DUPLICATE_HEADERS', `Duplicate headers are not allowed: ${duplicateHeaders.join(', ')}.`);
  }
  const unsupportedHeaders = headers.filter((header) => !USER_IMPORT_COLUMNS.includes(header as UserImportColumn));
  if (unsupportedHeaders.length) {
    throw new UserWorkbookError(
      'UNSUPPORTED_COLUMNS',
      `Unsupported or blank columns: ${unsupportedHeaders.map((header) => header || '(blank)').join(', ')}.`,
    );
  }
  const missingHeaders = USER_IMPORT_COLUMNS.filter((header) => !headers.includes(header));
  if (missingHeaders.length) {
    throw new UserWorkbookError('MISSING_HEADERS', `Missing required headers: ${missingHeaders.join(', ')}.`);
  }
  if (headers.length !== USER_IMPORT_COLUMNS.length || headers.some((header, index) => header !== USER_IMPORT_COLUMNS[index])) {
    throw new UserWorkbookError('INVALID_HEADER_ORDER', 'The Users worksheet columns must remain in the order provided by the Excel template.');
  }

  const rows: ParsedUserImportRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (worksheetRow, rowNumber) => {
    if (rowNumber === 1) return;
    let hasUsableCell = false;
    worksheetRow.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.value !== null && cell.value !== undefined && (isFormulaCell(cell) || String(cell.text ?? '').trim())) {
        hasUsableCell = true;
      }
      if (cell.fullAddress.col > headers.length) {
        addError(errorsByRow, rowNumber, `Row contains data outside the declared header columns (column ${cell.fullAddress.col}).`);
      }
    });
    if (!hasUsableCell) return;
    if (rows.length >= MAX_WORKBOOK_ROWS) {
      throw new UserWorkbookError('WORKBOOK_TOO_MANY_ROWS', `The workbook exceeds the maximum of ${MAX_WORKBOOK_ROWS.toLocaleString()} data rows.`);
    }

    const values: Partial<Record<UserImportColumn, string>> = {};
    headers.forEach((header, index) => {
      const column = header as UserImportColumn;
      values[column] = plainTextValue(worksheetRow.getCell(index + 1), rowNumber, column, errorsByRow);
    });
    rows.push(rowFromValues(rowNumber, values));
  });

  if (!rows.length) throw new UserWorkbookError('EMPTY_WORKBOOK', 'The Users worksheet does not contain any data rows.');
  return { headers, rows, errorsByRow };
}

function styleHeader(worksheet: Worksheet) {
  const required = new Set<UserImportColumn>([
    'employee_id', 'english_name', 'department_code', 'job_title', 'role', 'role_scope', 'status', 'user_type',
    'account_action',
  ]);
  worksheet.getRow(1).height = 24;
  worksheet.getRow(1).eachCell((cell, columnNumber) => {
    const column = USER_IMPORT_COLUMNS[columnNumber - 1];
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: required.has(column) ? 'FF1F4E78' : 'FF548235' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.protection = { locked: true };
  });
}

function applyUserWorksheetFormatting(worksheet: Worksheet) {
  styleHeader(worksheet);
  worksheet.autoFilter = { from: 'A1', to: `L${MAX_WORKBOOK_ROWS + 1}` };
  [18, 28, 28, 34, 20, 22, 28, 24, 20, 16, 20, 20].forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
  [1, 4, 5, 6].forEach((columnNumber) => {
    worksheet.getColumn(columnNumber).numFmt = '@';
  });
  for (let rowNumber = 2; rowNumber <= MAX_WORKBOOK_ROWS + 1; rowNumber += 1) {
    worksheet.getCell(rowNumber, 8).dataValidation = {
      type: 'list', allowBlank: false, formulae: [`"${userRoleOptions.join(',')}"`],
    };
    worksheet.getCell(rowNumber, 9).dataValidation = {
      type: 'list', allowBlank: false, formulae: [`"${userImportScopeOptions.join(',')}"`],
    };
    worksheet.getCell(rowNumber, 10).dataValidation = {
      type: 'list', allowBlank: false, formulae: [`"${userStatusOptions.join(',')}"`],
    };
    worksheet.getCell(rowNumber, 11).dataValidation = {
      type: 'list', allowBlank: false, formulae: [`"${userTypeOptions.join(',')}"`],
    };
    worksheet.getCell(rowNumber, 12).dataValidation = {
      type: 'list', allowBlank: false, formulae: [`"${userImportAccountActionOptions.join(',')}"`],
    };
  }
}

function bufferCopy(buffer: ArrayBuffer | ArrayBufferView) {
  const bytes = buffer instanceof ArrayBuffer
    ? new Uint8Array(buffer)
    : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function createUserImportTemplate(): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs/dist/exceljs.min.js');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GRC Control Center';
  workbook.created = new Date(0);

  const worksheet = workbook.addWorksheet('Users', { views: [{ state: 'frozen', ySplit: 1 }] });
  worksheet.addRow([...USER_IMPORT_COLUMNS]);
  worksheet.addRow([
    'EMP-00125',
    'Example User',
    'مستخدم تجريبي',
    'example.user@example.invalid',
    '+966501234567',
    'GOV',
    'Governance Analyst',
    'employee',
    'assigned_only',
    'active',
    'employee',
    'create_or_update',
  ]);
  applyUserWorksheetFormatting(worksheet);

  const instructions = workbook.addWorksheet('Instructions');
  instructions.getColumn(1).width = 120;
  instructions.addRows([
    ['Controlled User Excel Import Instructions'],
    ['Complete only the Users worksheet. Keep the header names and order unchanged; remove the example row before importing real users.'],
    ['Required: employee_id, english_name, department_code, job_title, role, role_scope, status, user_type, and account_action.'],
    ['contact_email and phone are optional. contact_email is contact information only; it is not the login identity. Validate it only when populated.'],
    ['arabic_name is required for employee users. It is optional for vendor, service_account, and external_auditor users.'],
    [`Accepted role values: ${userRoleOptions.join(', ')}.`],
    [`Accepted role_scope values: ${userImportScopeOptions.join(', ')}. Division and unit scopes are not supported by this import.`],
    ['Scope rules: global applies across the organization; department binds the role to the active department_code; assigned_only limits the role to explicitly assigned records.'],
    ['Strict role/scope matrix: super_admin, executive, governance_admin, auditor, and compliance_officer require global; department_manager requires department; project_owner, milestone_owner, task_owner, viewer, and employee require assigned_only. division_head is not supported because this import has no division scope/reference. Unsupported combinations are validation errors.'],
    ['For an existing profile, the workbook role and role_scope are authoritative within the organization. Preview warnings identify active assignments that execution will deactivate. Disabled lifecycle statuses deactivate every active role assignment.'],
    [`Accepted status values: ${userStatusOptions.join(', ')}.`],
    [`Accepted user_type values: ${userTypeOptions.join(', ')}.`],
    [`Accepted account_action values: ${userImportAccountActionOptions.join(', ')}. create requires a new identity; update requires exactly one existing profile; create_or_update updates an exact profile match or otherwise plans controlled provisioning.`],
    ['Accepted Saudi mobile formats: 0501234567, 966501234567, 00966501234567, and +966501234567. Valid values are stored as +966501234567.'],
    ['Employee ID, phone, contact_email, and department code must remain Excel Text. Leading zeros and plus signs are significant and must not be reconstructed.'],
    ['Employee ID is preserved exactly after trimming surrounding whitespace. It may contain only letters, digits, period, underscore, and hyphen.'],
    ['The managed login identity is derived as lower(employee_id) + @almodawat.sa. contact_email is stored separately and is never used to derive or match the login identity.'],
    ['Unknown accounts are tracked for separate controlled account creation. This workbook never creates Supabase Auth users from the browser.'],
    ['Formulas are prohibited in every user-entered column. Use plain text values only.'],
    ['Never enter passwords, temporary passwords, National ID, Iqama, service-role credentials, or other sensitive credentials in this workbook.'],
    ['Previewing and validation do not modify data. Only an authenticated authorized administrator can execute a valid import.'],
  ]);
  instructions.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF1F4E78' } };
  instructions.getColumn(1).alignment = { wrapText: true, vertical: 'top' };

  return bufferCopy(await workbook.xlsx.writeBuffer());
}

type RosterExportRow = {
  employee_no: string | null;
  full_name_en: string;
  full_name_ar: string | null;
  email: string;
  auth_email?: string | null;
  contact_email?: string | null;
  phone: string | null;
  department_code: string | null;
  department_name: string | null;
  job_title: string | null;
  roles?: Array<{ role: string; scope: string; is_active: boolean }>;
  user_status: string;
  user_type: string;
  last_login_at: string | null;
  created_at: string;
};

export async function createUserRosterWorkbook(rows: RosterExportRow[]): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs/dist/exceljs.min.js');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GRC Control Center';
  workbook.created = new Date(0);
  const worksheet = workbook.addWorksheet('User Roster', { views: [{ state: 'frozen', ySplit: 1 }] });
  const headers = [
    'Employee ID', 'English Name', 'Arabic Name', 'Auth Email', 'Contact Email', 'Phone', 'Department Code', 'Department Name',
    'Job Title', 'Active Roles', 'Active Role Scopes', 'Status', 'User Type', 'Last Login', 'Created Date',
  ];
  worksheet.addRow(headers);
  rows.forEach((row) => {
    const activeRoles = row.roles?.filter((role) => role.is_active) ?? [];
    worksheet.addRow([
      row.employee_no ?? '', row.full_name_en, row.full_name_ar ?? '', row.auth_email ?? '', row.contact_email ?? '', row.phone ?? '',
      row.department_code ?? '', row.department_name ?? '', row.job_title ?? '',
      activeRoles.map((role) => role.role).join('; '), activeRoles.map((role) => role.scope).join('; '),
      row.user_status, row.user_type, row.last_login_at ?? '', row.created_at,
    ]);
  });
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  worksheet.autoFilter = { from: 'A1', to: `O${Math.max(2, rows.length + 1)}` };
  [18, 28, 28, 34, 34, 20, 18, 28, 28, 30, 30, 16, 20, 24, 24].forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
  [1, 4, 5, 6, 7].forEach((columnNumber) => { worksheet.getColumn(columnNumber).numFmt = '@'; });
  return bufferCopy(await workbook.xlsx.writeBuffer());
}

export async function createUserValidationErrorsWorkbook(rows: ParsedUserImportRow[]): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs/dist/exceljs.min.js');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GRC Control Center';
  workbook.created = new Date(0);
  const worksheet = workbook.addWorksheet('Validation Errors', { views: [{ state: 'frozen', ySplit: 1 }] });
  worksheet.addRow([
    'Row Number', 'Employee ID', 'Synthetic Auth Email', 'Contact Email', 'Original Phone', 'Normalized Phone',
    'Account Action', 'Matched Profile', 'Matched Auth Identity', 'Planned Operation', 'Errors', 'Warnings',
  ]);
  rows
    .filter((row) => row.validation_errors?.length || row.validation_warnings?.length)
    .forEach((row) => worksheet.addRow([
      row.row_number,
      row.employee_no,
      row.synthetic_auth_email,
      row.contact_email,
      row.phone_original,
      row.phone_normalized ?? '',
      row.account_action,
      row.matched_user_label ?? '',
      row.matched_auth_identity_label ?? '',
      row.planned_action ?? 'rejected',
      row.validation_errors?.join('; ') ?? '',
      row.validation_warnings?.join('; ') ?? '',
    ]));
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } };
  worksheet.autoFilter = { from: 'A1', to: `L${Math.max(2, worksheet.rowCount)}` };
  [12, 20, 34, 34, 22, 22, 22, 40, 40, 30, 60, 60].forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
  [2, 3, 4, 5, 6].forEach((columnNumber) => { worksheet.getColumn(columnNumber).numFmt = '@'; });
  return bufferCopy(await workbook.xlsx.writeBuffer());
}

export { MAX_WORKBOOK_ROWS, TEXT_ENTRY_ERROR };
