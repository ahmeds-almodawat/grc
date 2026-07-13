export const DEPARTMENT_IMPORT_COLUMNS = [
  'organization_code',
  'division_code',
  'department_code',
  'department_name_en',
  'department_name_ar',
  'department_type',
  'manager_email',
  'status',
] as const;

export const REQUIRED_DEPARTMENT_IMPORT_COLUMNS = [
  'organization_code',
  'department_code',
  'department_name_en',
  'department_name_ar',
  'department_type',
  'status',
] as const;

export const ALLOWED_DEPARTMENT_TYPES = ['clinical', 'administrative', 'support'] as const;
export const ALLOWED_DEPARTMENT_STATUSES = ['active', 'inactive'] as const;
export const DEPARTMENT_IMPORT_ORGANIZATION_CODE = 'ALMODAWAT';

export type DepartmentImportColumn = (typeof DEPARTMENT_IMPORT_COLUMNS)[number];
export type DepartmentImportRawData = Record<DepartmentImportColumn, string>;

export interface NormalizedDepartmentImportRow {
  row_number: number;
  raw_data: DepartmentImportRawData;
}

export interface ImportValidationResult {
  headers: string[];
  rows: NormalizedDepartmentImportRow[];
  errorsByRow: Record<number, string[]>;
  validRows: number;
  invalidRows: number;
}

export interface RefData {
  activeOrganizationCode: string;
  divs: Set<string>;
  depts: Set<string>;
  archivedDeptKeys?: Set<string>;
  managers: Map<string, { is_active?: boolean; user_status?: string; organization_code?: string }>;
}

function addError(errorsByRow: Record<number, string[]>, rowNumber: number, message: string) {
  const errors = errorsByRow[rowNumber] ?? [];
  if (!errors.includes(message)) errorsByRow[rowNumber] = [...errors, message];
}

function normalizedName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeRawData(input: Partial<Record<DepartmentImportColumn, string>>): DepartmentImportRawData {
  const value = (column: DepartmentImportColumn) => String(input[column] ?? '').trim();
  return {
    organization_code: value('organization_code').toUpperCase(),
    division_code: value('division_code').toUpperCase(),
    department_code: value('department_code').toUpperCase(),
    department_name_en: value('department_name_en'),
    department_name_ar: value('department_name_ar'),
    department_type: value('department_type').toLowerCase(),
    manager_email: value('manager_email').toLowerCase(),
    status: value('status').toLowerCase(),
  };
}

export function createNormalizedDepartmentImportRow(
  rowNumber: number,
  input: Partial<Record<DepartmentImportColumn, string>>,
): NormalizedDepartmentImportRow {
  return { row_number: rowNumber, raw_data: normalizeRawData(input) };
}

function markDuplicateGroups(
  groups: Map<string, number[]>,
  errorsByRow: Record<number, string[]>,
  message: (rows: number[]) => string,
) {
  groups.forEach((rowNumbers) => {
    if (rowNumbers.length < 2) return;
    rowNumbers.forEach((rowNumber) => addError(errorsByRow, rowNumber, message(rowNumbers)));
  });
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateDepartmentImportRows(
  headers: string[],
  inputRows: NormalizedDepartmentImportRow[],
  refData: RefData | null,
  initialErrorsByRow: Record<number, string[]> = {},
): ImportValidationResult {
  const trimmedHeaders = headers.map((header) => header.trim());
  const rows = inputRows.map((row) => ({
    row_number: row.row_number,
    raw_data: normalizeRawData(row.raw_data),
  }));
  const errorsByRow = Object.fromEntries(
    Object.entries(initialErrorsByRow).map(([rowNumber, errors]) => [Number(rowNumber), [...errors]]),
  ) as Record<number, string[]>;

  const headerPositions = new Map<string, number[]>();
  trimmedHeaders.forEach((header, index) => {
    const positions = headerPositions.get(header) ?? [];
    positions.push(index + 1);
    headerPositions.set(header, positions);
  });

  const blankHeaderColumns = headerPositions.get('') ?? [];
  if (blankHeaderColumns.length) {
    addError(errorsByRow, 0, `Blank column headers found at columns: ${blankHeaderColumns.join(', ')}`);
  }

  const duplicateHeaders = [...headerPositions.entries()]
    .filter(([header, positions]) => header && positions.length > 1)
    .map(([header]) => header);
  if (duplicateHeaders.length) {
    addError(errorsByRow, 0, `Duplicate column headers: ${duplicateHeaders.join(', ')}`);
  }

  const missingHeaders = REQUIRED_DEPARTMENT_IMPORT_COLUMNS.filter(
    (column) => !trimmedHeaders.includes(column),
  );
  if (missingHeaders.length) {
    addError(errorsByRow, 0, `Missing required columns: ${missingHeaders.join(', ')}`);
  }

  const unsupportedHeaders = [...new Set(
    trimmedHeaders.filter(
      (header) => header && !DEPARTMENT_IMPORT_COLUMNS.includes(header as DepartmentImportColumn),
    ),
  )];
  if (unsupportedHeaders.length) {
    addError(errorsByRow, 0, `Unsupported columns: ${unsupportedHeaders.join(', ')}`);
  }

  if (!rows.length) addError(errorsByRow, 0, 'Workbook contains no usable data rows.');
  if (rows.length > 5000) addError(errorsByRow, 0, 'Workbook exceeds the maximum of 5,000 data rows.');

  const organizationCodes = new Set<string>();
  const codeGroups = new Map<string, number[]>();
  const rowGroups = new Map<string, number[]>();

  rows.forEach((row) => {
    const data = row.raw_data;
    const rowNumber = row.row_number;

    REQUIRED_DEPARTMENT_IMPORT_COLUMNS.forEach((column) => {
      if (!data[column]) addError(errorsByRow, rowNumber, `${column} is required`);
    });

    if (data.organization_code) organizationCodes.add(data.organization_code);

    if (data.department_code) {
      const codeRows = codeGroups.get(data.department_code) ?? [];
      codeRows.push(rowNumber);
      codeGroups.set(data.department_code, codeRows);
    }

    const rowSignature = DEPARTMENT_IMPORT_COLUMNS.map((column) => data[column]).join('\u001f');
    const duplicateRows = rowGroups.get(rowSignature) ?? [];
    duplicateRows.push(rowNumber);
    rowGroups.set(rowSignature, duplicateRows);

    if (data.department_type && !ALLOWED_DEPARTMENT_TYPES.includes(data.department_type as typeof ALLOWED_DEPARTMENT_TYPES[number])) {
      addError(errorsByRow, rowNumber, `Unsupported department_type: ${data.department_type}`);
    }

    if (data.status && !ALLOWED_DEPARTMENT_STATUSES.includes(data.status as typeof ALLOWED_DEPARTMENT_STATUSES[number])) {
      addError(errorsByRow, rowNumber, `Unsupported status: ${data.status}`);
    }

    if (data.manager_email && !emailPattern.test(data.manager_email)) {
      addError(errorsByRow, rowNumber, `Invalid manager_email: ${data.manager_email}`);
    }

    if (!refData) return;

    if (data.organization_code && data.organization_code !== refData.activeOrganizationCode.toUpperCase()) {
      addError(
        errorsByRow,
        rowNumber,
        `organization_code must match the active organization: ${refData.activeOrganizationCode.toUpperCase()}`,
      );
    }

    if (
      data.division_code
      && data.organization_code
      && !refData.divs.has(`${data.organization_code}|${data.division_code}`)
    ) {
      addError(errorsByRow, rowNumber, `Unknown division: ${data.division_code}`);
    }

    const nameEn = normalizedName(data.department_name_en);
    const nameAr = normalizedName(data.department_name_ar);
    const archivedMatch = Boolean(data.organization_code && (
      (data.department_code && refData.archivedDeptKeys?.has(`${data.organization_code}|CODE|${data.department_code}`))
      || (nameEn && refData.archivedDeptKeys?.has(`${data.organization_code}|NAME|${nameEn}`))
      || (nameAr && refData.archivedDeptKeys?.has(`${data.organization_code}|NAME|${nameAr}`))
    ));

    if (archivedMatch) {
      addError(
        errorsByRow,
        rowNumber,
        'archived_department_match: restore the matching department from Department Management before importing',
      );
    } else if (
      data.organization_code
      && data.department_code
      && refData.depts.has(`${data.organization_code}|${data.department_code}`)
    ) {
      addError(errorsByRow, rowNumber, `Active department code already exists: ${data.department_code}`);
    }

    if (data.manager_email && emailPattern.test(data.manager_email)) {
      const profile = refData.managers.get(data.manager_email);
      if (!profile) {
        addError(errorsByRow, rowNumber, `Unknown manager email: ${data.manager_email}`);
      } else if (profile.is_active === false || profile.user_status !== 'active') {
        addError(errorsByRow, rowNumber, `Manager is not active: ${data.manager_email}`);
      } else if (
        data.organization_code
        && profile.organization_code
        && profile.organization_code.toUpperCase() !== data.organization_code
      ) {
        addError(errorsByRow, rowNumber, `Manager outside organization: ${data.manager_email}`);
      }
    }
  });

  if (organizationCodes.size > 1) {
    addError(
      errorsByRow,
      0,
      `Workbook contains more than one organization code: ${[...organizationCodes].sort().join(', ')}`,
    );
  }

  markDuplicateGroups(
    codeGroups,
    errorsByRow,
    (rowNumbers) => `Duplicate department_code in workbook (rows ${rowNumbers.join(', ')})`,
  );
  markDuplicateGroups(
    rowGroups,
    errorsByRow,
    (rowNumbers) => `Duplicate row in workbook (rows ${rowNumbers.join(', ')})`,
  );

  const invalidRows = rows.filter((row) => (errorsByRow[row.row_number]?.length ?? 0) > 0).length;
  return {
    headers: trimmedHeaders,
    rows,
    errorsByRow,
    validRows: rows.length - invalidRows,
    invalidRows,
  };
}
