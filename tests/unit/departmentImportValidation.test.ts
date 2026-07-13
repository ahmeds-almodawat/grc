import { describe, expect, it } from 'vitest';
import {
  DEPARTMENT_IMPORT_COLUMNS,
  createNormalizedDepartmentImportRow,
  validateDepartmentImportRows,
  type DepartmentImportRawData,
  type RefData,
} from '../../src/utils/departmentImportValidation';

describe('departmentImportValidation', () => {
  const mockRefData: RefData = {
    activeOrganizationCode: 'ORG1',
    divs: new Set(['ORG1|DIV1']),
    depts: new Set(['ORG1|DEPT1', 'ORG1|DEPT2']),
    archivedDeptKeys: new Set([
      'ORG1|CODE|ARCHIVED',
      'ORG1|NAME|archived department',
      'ORG1|NAME|قسم مؤرشف',
    ]),
    managers: new Map([
      ['active@example.com', { user_status: 'active', organization_code: 'ORG1' }],
      ['inactive@example.com', { user_status: 'inactive', organization_code: 'ORG1' }],
      ['outside@example.com', { user_status: 'active', organization_code: 'ORG2' }],
    ]),
  };

  const validData: DepartmentImportRawData = {
    organization_code: 'ORG1',
    division_code: 'DIV1',
    department_code: 'NEW_DEPT',
    department_name_en: 'New Department',
    department_name_ar: 'قسم جديد',
    department_type: 'clinical',
    manager_email: 'active@example.com',
    status: 'active',
  };

  const row = (rowNumber: number, overrides: Partial<DepartmentImportRawData> = {}) => (
    createNormalizedDepartmentImportRow(rowNumber, { ...validData, ...overrides })
  );

  const validate = (
    rows = [row(2)],
    headers: string[] = [...DEPARTMENT_IMPORT_COLUMNS],
  ) => validateDepartmentImportRows(headers, rows, mockRefData);

  it('validates and normalizes a correct Arabic and English row', () => {
    const result = validate([row(2, {
      organization_code: ' org1 ',
      department_code: ' new_code ',
      department_name_en: ' English Name ',
      department_name_ar: ' الاسم العربي ',
      manager_email: ' ACTIVE@EXAMPLE.COM ',
    })]);

    expect(result.validRows).toBe(1);
    expect(result.invalidRows).toBe(0);
    expect(result.rows[0].raw_data).toMatchObject({
      organization_code: 'ORG1',
      department_code: 'NEW_CODE',
      department_name_en: 'English Name',
      department_name_ar: 'الاسم العربي',
      manager_email: 'active@example.com',
    });
  });

  it('marks every row sharing a duplicate department code', () => {
    const result = validate([
      row(2, { department_code: 'DUP', department_name_en: 'First' }),
      row(3, { department_code: 'dup', department_name_en: 'Second' }),
    ]);
    expect(result.invalidRows).toBe(2);
    expect(result.errorsByRow[2]).toContainEqual(expect.stringContaining('Duplicate department_code'));
    expect(result.errorsByRow[3]).toContainEqual(expect.stringContaining('Duplicate department_code'));
  });

  it('marks duplicate rows explicitly', () => {
    const result = validate([row(2), row(8)]);
    expect(result.invalidRows).toBe(2);
    expect(result.errorsByRow[2]).toContainEqual(expect.stringContaining('Duplicate row'));
    expect(result.errorsByRow[8]).toContainEqual(expect.stringContaining('Duplicate row'));
  });

  it('rejects an existing active department code', () => {
    const result = validate([row(2, { department_code: 'DEPT1' })]);
    expect(result.errorsByRow[2]).toContain('Active department code already exists: DEPT1');
  });

  it('requires the active organization and rejects multiple organization codes', () => {
    const result = validate([
      row(2),
      row(3, { organization_code: 'ORG2', department_code: 'OTHER' }),
    ]);
    expect(result.errorsByRow[0]).toContainEqual(expect.stringContaining('more than one organization code'));
    expect(result.errorsByRow[3]).toContain('organization_code must match the active organization: ORG1');
  });

  it('validates invalid, missing, inactive, and out-of-scope managers', () => {
    const result = validate([
      row(2, { department_code: 'D1', manager_email: 'not-an-email' }),
      row(3, { department_code: 'D2', manager_email: 'missing@example.com' }),
      row(4, { department_code: 'D3', manager_email: 'inactive@example.com' }),
      row(5, { department_code: 'D4', manager_email: 'outside@example.com' }),
    ]);
    expect(result.errorsByRow[2]).toContainEqual(expect.stringContaining('Invalid manager_email'));
    expect(result.errorsByRow[3]).toContainEqual(expect.stringContaining('Unknown manager email'));
    expect(result.errorsByRow[4]).toContainEqual(expect.stringContaining('Manager is not active'));
    expect(result.errorsByRow[5]).toContainEqual(expect.stringContaining('Manager outside organization'));
  });

  it('rejects invalid department type and status without coercing them', () => {
    const result = validate([row(2, { department_type: 'medical', status: 'archived' })]);
    expect(result.errorsByRow[2]).toContain('Unsupported department_type: medical');
    expect(result.errorsByRow[2]).toContain('Unsupported status: archived');
  });

  it('requires all six required columns in both headers and rows', () => {
    const headers = DEPARTMENT_IMPORT_COLUMNS.filter((header) => header !== 'department_name_ar');
    const result = validate([row(2, { department_name_ar: '' })], headers);
    expect(result.errorsByRow[0]).toContainEqual(expect.stringContaining('department_name_ar'));
    expect(result.errorsByRow[2]).toContain('department_name_ar is required');
  });

  it('rejects unsupported and duplicate headers', () => {
    const result = validate(
      [row(2)],
      [...DEPARTMENT_IMPORT_COLUMNS, 'department_code', 'unexpected_column'],
    );
    expect(result.errorsByRow[0]).toContainEqual(expect.stringContaining('Duplicate column headers: department_code'));
    expect(result.errorsByRow[0]).toContainEqual(expect.stringContaining('Unsupported columns: unexpected_column'));
  });

  it('blocks archived department matches by code or normalized English or Arabic name', () => {
    const result = validate([
      row(2, { department_code: 'ARCHIVED' }),
      row(3, { department_code: 'NEW_CODE', department_name_en: '  Archived   Department  ' }),
      row(4, { department_code: 'NEW_AR', department_name_ar: 'قسم مؤرشف' }),
    ]);
    expect(result.invalidRows).toBe(3);
    expect(result.errorsByRow[2]).toContainEqual(expect.stringContaining('archived_department_match'));
    expect(result.errorsByRow[3]).toContainEqual(expect.stringContaining('archived_department_match'));
    expect(result.errorsByRow[4]).toContainEqual(expect.stringContaining('archived_department_match'));
  });

  it('preserves parser-level row errors and blocks that row', () => {
    const result = validateDepartmentImportRows(
      [...DEPARTMENT_IMPORT_COLUMNS],
      [row(2)],
      mockRefData,
      { 2: ['Formula cells are not allowed (department_name_en).'] },
    );
    expect(result.invalidRows).toBe(1);
    expect(result.errorsByRow[2]).toContainEqual(expect.stringContaining('Formula cells'));
  });
});
