import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEPARTMENT_IMPORT_COLUMNS,
  validateDepartmentImportRows,
  type RefData,
} from '../../src/utils/departmentImportValidation';
import {
  DepartmentWorkbookError,
  createDepartmentImportFileState,
  createDepartmentImportTemplate,
  parseDepartmentWorkbook,
  type DepartmentWorkbookFile,
} from '../../src/utils/departmentWorkbook';

const refData: RefData = {
  activeOrganizationCode: 'ORG1',
  divs: new Set(['ORG1|DIV1']),
  depts: new Set(['ORG1|EXISTING']),
  archivedDeptKeys: new Set(['ORG1|CODE|ARCHIVED']),
  managers: new Map(),
};

const validRow = (code = 'DEPT1') => [
  'ORG1',
  'DIV1',
  code,
  `Department ${code}`,
  `قسم ${code}`,
  'clinical',
  '',
  'active',
];

function toArrayBuffer(buffer: ArrayBuffer | Uint8Array) {
  const source = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer);
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy.buffer;
}

function asFile(buffer: ArrayBuffer | Uint8Array, name = 'departments.xlsx'): DepartmentWorkbookFile {
  const bytes = toArrayBuffer(buffer);
  return {
    name,
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.slice(0),
  };
}

async function createWorkbookFile(
  rows: unknown[][],
  headers: string[] = [...DEPARTMENT_IMPORT_COLUMNS],
  configure?: (workbook: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet) => void,
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Departments');
  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));
  configure?.(workbook, worksheet);
  return asFile(await workbook.xlsx.writeBuffer());
}

async function parseAndValidate(file: DepartmentWorkbookFile, referenceData: RefData = refData) {
  const parsed = await parseDepartmentWorkbook(file);
  return validateDepartmentImportRows(parsed.headers, parsed.rows, referenceData, parsed.errorsByRow);
}

describe('departmentWorkbook', () => {
  it('uses an .xlsx-only upload UI with no pasted-text or CSV fallback', () => {
    const page = readFileSync('src/pages/Departments.tsx', 'utf8');
    expect(page).toContain('Upload Department Excel File');
    expect(page).toContain('Upload the completed Excel template. Previewing does not modify data.');
    expect(page).toContain('accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"');
    expect(page).toContain("'departments_template.xlsx'");
    expect(page).not.toContain('Paste CSV or Excel data');
    expect(page).not.toContain('departments_template.csv');
  });

  it('parses a valid .xlsx row and preserves Arabic and English text', async () => {
    const result = await parseAndValidate(await createWorkbookFile([
      ['ORG1', 'DIV1', 'AR_EN', 'Emergency Department', 'قسم الطوارئ', 'clinical', '', 'active'],
    ]));
    expect(result.validRows).toBe(1);
    expect(result.rows[0].raw_data.department_name_en).toBe('Emergency Department');
    expect(result.rows[0].raw_data.department_name_ar).toBe('قسم الطوارئ');
  });

  it('accepts a workbook containing 28 valid rows', async () => {
    const rows = Array.from({ length: 28 }, (_, index) => validRow(`DEPT_${index + 1}`));
    const result = await parseAndValidate(await createWorkbookFile(rows));
    expect(result.rows).toHaveLength(28);
    expect(result.validRows).toBe(28);
    expect(result.invalidRows).toBe(0);
  });

  it('maps reordered columns by trimmed header name', async () => {
    const headers = [
      ' department_code ',
      'organization_code',
      'status',
      'department_name_ar',
      'department_type',
      'department_name_en',
      'manager_email',
      'division_code',
    ];
    const row = ['REORDERED', 'ORG1', 'active', 'قسم مرتب', 'support', 'Reordered', '', 'DIV1'];
    const result = await parseAndValidate(await createWorkbookFile([row], headers));
    expect(result.validRows).toBe(1);
    expect(result.rows[0].raw_data).toMatchObject({
      department_code: 'REORDERED',
      department_name_ar: 'قسم مرتب',
      department_type: 'support',
    });
  });

  it('ignores completely blank rows between valid rows and preserves worksheet row numbers', async () => {
    const result = await parseAndValidate(await createWorkbookFile([
      validRow('FIRST'),
      ['', '', '', '', '', '', '', ''],
      validRow('SECOND'),
    ]));
    expect(result.rows.map((row) => row.row_number)).toEqual([2, 4]);
    expect(result.validRows).toBe(2);
  });

  it('parses only the first worksheet', async () => {
    const file = await createWorkbookFile([validRow('FIRST_SHEET')], [...DEPARTMENT_IMPORT_COLUMNS], (workbook) => {
      const second = workbook.addWorksheet('Ignored');
      second.addRow(['unsupported']);
      second.addRow(['bad']);
    });
    const result = await parseAndValidate(file);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].raw_data.department_code).toBe('FIRST_SHEET');
  });

  it('rejects missing and unsupported headers', async () => {
    const headers = DEPARTMENT_IMPORT_COLUMNS.filter((header) => header !== 'department_name_ar');
    const file = await createWorkbookFile([
      validRow('HEADER').filter((_, index) => index !== 4),
    ], [...headers, 'unexpected']);
    const result = await parseAndValidate(file);
    expect(result.errorsByRow[0]).toContainEqual(expect.stringContaining('Missing required columns: department_name_ar'));
    expect(result.errorsByRow[0]).toContainEqual(expect.stringContaining('Unsupported columns: unexpected'));
  });

  it('rejects duplicate headers after trimming', async () => {
    const result = await parseAndValidate(await createWorkbookFile(
      [validRow('DUP_HEADER')],
      [...DEPARTMENT_IMPORT_COLUMNS, ' department_code '],
    ));
    expect(result.errorsByRow[0]).toContainEqual(expect.stringContaining('Duplicate column headers: department_code'));
  });

  it('rejects formula cells without trusting cached formula results', async () => {
    const file = await createWorkbookFile([validRow('FORMULA')], [...DEPARTMENT_IMPORT_COLUMNS], (_, worksheet) => {
      worksheet.getCell('D2').value = { formula: '1+1', result: 'Trusted-looking result' };
    });
    const result = await parseAndValidate(file);
    expect(result.errorsByRow[2]).toContainEqual(expect.stringContaining('Formula cells are not allowed'));
    expect(result.rows[0].raw_data.department_name_en).toBe('');
  });

  it('rejects formula cells even when they have no cached result', async () => {
    const file = await createWorkbookFile([], [...DEPARTMENT_IMPORT_COLUMNS], (_, worksheet) => {
      worksheet.getCell('D2').value = { formula: '1+1' };
    });
    const result = await parseAndValidate(file);
    expect(result.rows).toHaveLength(1);
    expect(result.errorsByRow[2]).toContainEqual(expect.stringContaining('Formula cells are not allowed'));
  });

  it('rejects an empty workbook and a workbook with no usable data rows', async () => {
    const empty = new ExcelJS.Workbook();
    empty.addWorksheet('Empty');
    await expect(parseDepartmentWorkbook(asFile(await empty.xlsx.writeBuffer()))).rejects.toMatchObject({
      code: 'EMPTY_WORKBOOK',
    });

    const headersOnly = await createWorkbookFile([]);
    const parsed = await parseDepartmentWorkbook(headersOnly);
    const result = validateDepartmentImportRows(parsed.headers, parsed.rows, refData, parsed.errorsByRow);
    expect(result.errorsByRow[0]).toContain('Workbook contains no usable data rows.');
  });

  it('rejects corrupt workbooks and CSV content renamed to .xlsx', async () => {
    const corrupt = asFile(new TextEncoder().encode('not a zip workbook'));
    await expect(parseDepartmentWorkbook(corrupt)).rejects.toBeInstanceOf(DepartmentWorkbookError);

    const renamedCsv = asFile(new TextEncoder().encode(
      'organization_code,department_code,department_name_en\nORG1,D1,Department',
    ));
    await expect(parseDepartmentWorkbook(renamedCsv)).rejects.toMatchObject({ code: 'CORRUPT_WORKBOOK' });
  });

  it('rejects CSV and legacy .xls extensions explicitly', async () => {
    const bytes = new TextEncoder().encode('data');
    await expect(parseDepartmentWorkbook(asFile(bytes, 'departments.csv'))).rejects.toMatchObject({
      code: 'UNSUPPORTED_FILE_TYPE',
    });
    await expect(parseDepartmentWorkbook(asFile(bytes, 'departments.xls'))).rejects.toMatchObject({
      code: 'UNSUPPORTED_FILE_TYPE',
    });
  });

  it('replacement state clears previous preview, validation, and parse errors', () => {
    const previous = {
      file: { name: 'old.xlsx', size: 100 },
      validation: { validRows: 2 },
      parseError: 'old error',
      parsing: false,
    };
    const replacement = createDepartmentImportFileState({ name: 'new.xlsx', size: 200 });
    expect(previous.validation).not.toBeNull();
    expect(replacement).toEqual({
      file: { name: 'new.xlsx', size: 200 },
      validation: null,
      parseError: null,
      parsing: true,
    });
  });

  it('generates a valid reusable .xlsx template with formatting and dropdowns', async () => {
    const template = await createDepartmentImportTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(template);
    const worksheet = workbook.worksheets[0];

    expect(worksheet.name).toBe('Departments');
    expect(worksheet.getRow(1).font.bold).toBe(true);
    expect(worksheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(worksheet.autoFilter).toBeTruthy();
    expect(worksheet.getCell('F2').dataValidation.type).toBe('list');
    expect(worksheet.getCell('H2').dataValidation.type).toBe('list');
    expect(workbook.worksheets[1].name).toBe('Instructions');

    const templateRefData: RefData = {
      activeOrganizationCode: 'ALMODAWAT',
      divs: new Set(['ALMODAWAT|MED']),
      depts: new Set(),
      archivedDeptKeys: new Set(),
      managers: new Map([
        ['nursing.manager@almodawat.sa', { user_status: 'active', organization_code: 'ALMODAWAT' }],
      ]),
    };
    const roundTrip = await parseAndValidate(asFile(template), templateRefData);
    expect(roundTrip.validRows).toBe(1);
    expect(roundTrip.invalidRows).toBe(0);
    expect(roundTrip.rows[0].raw_data.department_name_ar).toBe('التمريض');
  });
});
