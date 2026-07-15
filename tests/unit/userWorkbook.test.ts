import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
  TEXT_ENTRY_ERROR,
  USER_IMPORT_COLUMNS,
  UserWorkbookError,
  createUserImportTemplate,
  createUserRosterWorkbook,
  createUserValidationErrorsWorkbook,
  parseUserWorkbook,
} from '../../src/utils/userWorkbook';

function toArrayBuffer(buffer: ArrayBuffer | Uint8Array): ArrayBuffer {
  const source = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer);
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy.buffer;
}

async function workbookFile(
  rows: unknown[][],
  options: {
    headers?: string[];
    name?: string;
    configure?: (workbook: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet) => void;
  } = {},
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Users');
  worksheet.addRow(options.headers ?? [...USER_IMPORT_COLUMNS]);
  rows.forEach((row) => worksheet.addRow(row));
  options.configure?.(workbook, worksheet);
  const bytes = toArrayBuffer(await workbook.xlsx.writeBuffer());
  return {
    name: options.name ?? 'users.xlsx',
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.slice(0),
  };
}

function validRow(overrides: Partial<Record<typeof USER_IMPORT_COLUMNS[number], unknown>> = {}) {
  const values: Record<typeof USER_IMPORT_COLUMNS[number], unknown> = {
    employee_id: '001245',
    english_name: 'Aisha Example',
    arabic_name: 'عائشة مثال',
    contact_email: 'aisha@example.test',
    phone: '+966501234567',
    department_code: 'GOV',
    job_title: 'Governance Analyst',
    role: 'employee',
    role_scope: 'assigned_only',
    status: 'active',
    user_type: 'employee',
    account_action: 'create_or_update',
    ...overrides,
  };
  return USER_IMPORT_COLUMNS.map((column) => values[column]);
}

describe('Patch 83T User workbook parsing', () => {
  it('preserves Arabic, leading-zero, alphanumeric, plus-sign, and zero-prefixed text exactly', async () => {
    const file = await workbookFile([
      validRow(),
      validRow({
        employee_id: 'EMP-00125',
        english_name: 'Omar Example',
        arabic_name: 'عمر مثال',
        contact_email: 'omar@example.test',
        phone: '0501234567',
      }),
      validRow({
        employee_id: '0000098',
        english_name: 'Sara Example',
        arabic_name: 'سارة مثال',
        contact_email: 'sara@example.test',
        phone: '00966501234567',
      }),
    ]);

    const parsed = await parseUserWorkbook(file);
    expect(parsed.rows[0]).toMatchObject({
      employee_no: '001245',
      synthetic_auth_email: '001245@almodawat.sa',
      contact_email: 'aisha@example.test',
      full_name_ar: 'عائشة مثال',
      phone_original: '+966501234567',
    });
    expect(parsed.rows[1]).toMatchObject({ employee_no: 'EMP-00125', phone_original: '0501234567' });
    expect(parsed.rows[2]).toMatchObject({ employee_no: '0000098', phone_original: '00966501234567' });
    expect(parsed.errorsByRow).toEqual({});
  });

  it('preserves a five-character Employee ID and trims only surrounding whitespace', async () => {
    const parsed = await parseUserWorkbook(await workbookFile([
      validRow({ employee_id: '  11111  ', contact_email: '' }),
    ]));

    expect(parsed.rows[0]).toMatchObject({
      employee_no: '11111',
      synthetic_auth_email: '11111@almodawat.sa',
      contact_email: '',
    });
    expect(parsed.errorsByRow).toEqual({});
  });

  it('rejects numeric Employee ID and phone cells even when Excel Text formatting is applied', async () => {
    const numericEmployee = await workbookFile([validRow({ employee_id: 1245 })], {
      configure: (_workbook, worksheet) => { worksheet.getCell('A2').numFmt = '@'; },
    });
    const numericPhone = await workbookFile([validRow({ phone: 501234567 })], {
      configure: (_workbook, worksheet) => { worksheet.getCell('E2').numFmt = '@'; },
    });

    const employeeParsed = await parseUserWorkbook(numericEmployee);
    const phoneParsed = await parseUserWorkbook(numericPhone);
    expect(employeeParsed.errorsByRow[2]).toContain(`employee_id: ${TEXT_ENTRY_ERROR}`);
    expect(phoneParsed.errorsByRow[2]).toContain(`phone: ${TEXT_ENTRY_ERROR}`);
    expect(employeeParsed.rows[0].employee_no).toBe('');
    expect(phoneParsed.rows[0].phone_original).toBe('');
  });

  it('rejects formulas in every user-entered column', async () => {
    const file = await workbookFile([validRow()], {
      configure: (_workbook, worksheet) => {
        worksheet.getCell('B2').value = { formula: 'CONCAT("Injected"," Name")', result: 'Injected Name' };
        worksheet.getCell('D2').value = { formula: 'LOWER("A@EXAMPLE.TEST")', result: 'a@example.test' };
      },
    });
    const parsed = await parseUserWorkbook(file);
    expect(parsed.errorsByRow[2]).toEqual(expect.arrayContaining([
      'Formula cells are not allowed (english_name).',
      'Formula cells are not allowed (contact_email).',
    ]));
  });

  it.each([
    ['users.csv', 'name,not,xlsx', 'UNSUPPORTED_FILE_TYPE'],
    ['users.xls', 'legacy-xls', 'UNSUPPORTED_FILE_TYPE'],
    ['renamed.xlsx', 'employee_id,english_name\n001,Aisha', 'CORRUPT_WORKBOOK'],
    ['corrupt.xlsx', 'not-an-excel-workbook', 'CORRUPT_WORKBOOK'],
  ])('rejects invalid workbook %s', async (name, content, code) => {
    const bytes = Buffer.from(content);
    await expect(parseUserWorkbook({
      name,
      size: bytes.byteLength,
      arrayBuffer: async () => toArrayBuffer(bytes),
    })).rejects.toMatchObject<UserWorkbookError>({ code });
  });

  it('rejects workbook metadata above the 5 MB limit before reading bytes', async () => {
    let bytesRead = false;
    await expect(parseUserWorkbook({
      name: 'too-large.xlsx',
      size: (5 * 1024 * 1024) + 1,
      arrayBuffer: async () => {
        bytesRead = true;
        return new ArrayBuffer(0);
      },
    })).rejects.toMatchObject({ code: 'WORKBOOK_TOO_LARGE' });
    expect(bytesRead).toBe(false);
  });

  it('rejects missing, duplicate, unsupported, out-of-order, and ambiguous data sheets', async () => {
    await expect(parseUserWorkbook(await workbookFile([validRow().filter((_value, index) => index !== 4)], {
      headers: USER_IMPORT_COLUMNS.filter((column) => column !== 'phone'),
    }))).rejects.toMatchObject({ code: 'MISSING_HEADERS' });

    const duplicateHeaders = [...USER_IMPORT_COLUMNS];
    duplicateHeaders[1] = 'employee_id';
    await expect(parseUserWorkbook(await workbookFile([validRow()], { headers: duplicateHeaders })))
      .rejects.toMatchObject({ code: 'DUPLICATE_HEADERS' });

    await expect(parseUserWorkbook(await workbookFile([validRow()], {
      headers: [...USER_IMPORT_COLUMNS.slice(0, 11), 'password'],
    }))).rejects.toMatchObject({ code: 'UNSUPPORTED_COLUMNS' });

    const reversed = [...USER_IMPORT_COLUMNS].reverse();
    await expect(parseUserWorkbook(await workbookFile([validRow()], { headers: reversed })))
      .rejects.toMatchObject({ code: 'INVALID_HEADER_ORDER' });

    const ambiguous = await workbookFile([validRow()], {
      configure: (workbook) => {
        const second = workbook.addWorksheet('Other Users');
        second.addRow(USER_IMPORT_COLUMNS);
        second.addRow(validRow());
      },
    });
    await expect(parseUserWorkbook(ambiguous)).rejects.toMatchObject({ code: 'AMBIGUOUS_DATA_SHEETS' });
  });

  it('requires the Users worksheet and enforces the 5,000-row limit', async () => {
    const wrongSheet = await workbookFile([validRow()], {
      configure: (_workbook, worksheet) => { worksheet.name = 'Sheet1'; },
    });
    await expect(parseUserWorkbook(wrongSheet)).rejects.toMatchObject({ code: 'USERS_WORKSHEET_REQUIRED' });

    const tooManyRows = await workbookFile(
      Array.from({ length: 5001 }, (_value, index) => validRow({
        employee_id: `ROW-${index + 1}`,
        contact_email: `row.${index + 1}@example.test`,
      })),
    );
    await expect(parseUserWorkbook(tooManyRows)).rejects.toMatchObject({ code: 'WORKBOOK_TOO_MANY_ROWS' });
  });

  it('creates a professionally formatted template with text columns, dropdowns, Arabic, and safety instructions', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await createUserImportTemplate());
    const worksheet = workbook.getWorksheet('Users');
    const instructions = workbook.getWorksheet('Instructions');
    expect(worksheet).toBeTruthy();
    expect(instructions).toBeTruthy();
    expect(worksheet!.getRow(1).values).toEqual([undefined, ...USER_IMPORT_COLUMNS]);
    expect(worksheet!.getCell('C2').text).toBe('مستخدم تجريبي');
    expect(worksheet!.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(worksheet!.autoFilter).toBeTruthy();
    expect(worksheet!.columns.every((column) => Number(column.width ?? 0) >= 16)).toBe(true);
    expect(worksheet!.getColumn(1).numFmt).toBe('@');
    expect(worksheet!.getColumn(4).numFmt).toBe('@');
    expect(worksheet!.getColumn(5).numFmt).toBe('@');
    expect(worksheet!.getColumn(6).numFmt).toBe('@');
    expect(worksheet!.getCell('H5001').dataValidation.type).toBe('list');
    expect(worksheet!.getCell('I5001').dataValidation.type).toBe('list');
    expect(worksheet!.getCell('J5001').dataValidation.type).toBe('list');
    expect(worksheet!.getCell('K5001').dataValidation.type).toBe('list');
    expect(worksheet!.getCell('L5001').dataValidation.type).toBe('list');
    expect(worksheet!.getCell('L5001').dataValidation.formulae).toEqual(['"create,update,create_or_update"']);
    expect(worksheet!.getCell('A1').fill).not.toEqual(worksheet!.getCell('E1').fill);
    const instructionText = instructions!.getColumn(1).values.join('\n');
    expect(instructionText).toContain('Employee ID');
    expect(instructionText).toContain('Formulas are prohibited');
    expect(instructionText).toContain('Never enter passwords');
    expect(instructionText).toContain('lower(employee_id) + @almodawat.sa');
    expect(instructionText).toContain('contact_email and phone are optional');
    expect(instructionText).toContain('create_or_update');
    expect(instructionText).toContain('Strict role/scope matrix');
    expect(instructionText).toContain('Unsupported combinations are validation errors');
    expect(instructionText).toContain('00966501234567');
    expect(USER_IMPORT_COLUMNS).not.toContain('password');
  });

  it('creates roster and validation exports as formatted xlsx workbooks', async () => {
    const roster = new ExcelJS.Workbook();
    await roster.xlsx.load(await createUserRosterWorkbook([{
      employee_no: '001245',
      full_name_en: 'Aisha Example',
      full_name_ar: 'عائشة مثال',
      email: '001245@almodawat.sa',
      auth_email: '001245@almodawat.sa',
      contact_email: 'aisha@example.test',
      phone: '+966501234567',
      department_code: 'GOV',
      department_name: 'Governance',
      job_title: 'Analyst',
      roles: [
        { role: 'employee', scope: 'assigned_only', is_active: true },
        { role: 'viewer', scope: 'global', is_active: false },
      ],
      user_status: 'active',
      user_type: 'employee',
      last_login_at: '2026-07-14T10:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
    }]));
    const rosterSheet = roster.getWorksheet('User Roster');
    expect(rosterSheet?.getRow(1).values).toEqual([
      undefined, 'Employee ID', 'English Name', 'Arabic Name', 'Auth Email', 'Contact Email', 'Phone', 'Department Code',
      'Department Name', 'Job Title', 'Active Roles', 'Active Role Scopes', 'Status', 'User Type', 'Last Login', 'Created Date',
    ]);
    expect(rosterSheet?.getRow(2).getCell(4).value).toBe('001245@almodawat.sa');
    expect(rosterSheet?.getRow(2).getCell(5).value).toBe('aisha@example.test');
    expect(rosterSheet?.getRow(2).getCell(10).value).toBe('employee');
    expect(rosterSheet?.getRow(2).getCell(11).value).toBe('assigned_only');
    expect(rosterSheet?.getColumn(1).numFmt).toBe('@');

    const validation = new ExcelJS.Workbook();
    await validation.xlsx.load(await createUserValidationErrorsWorkbook([{
      row_number: 2,
      employee_no: '001245',
      full_name_en: 'Aisha Example',
      full_name_ar: 'عائشة مثال',
      contact_email: 'aisha@example.test',
      synthetic_auth_email: '001245@almodawat.sa',
      phone_original: '0501234567',
      phone_normalized: '+966501234567',
      department: 'GOV',
      job_title: 'Analyst',
      role: 'employee',
      role_scope: 'assigned_only',
      status: 'active',
      user_type: 'employee',
      account_action: 'update',
      matched_user_label: 'Aisha Example (001245@almodawat.sa)',
      matched_auth_identity_label: '001245@almodawat.sa',
      planned_action: 'rejected',
      validation_status: 'error',
      validation_errors: ['Example validation error.'],
      validation_warnings: ['Example validation warning.'],
    }]));
    const validationSheet = validation.getWorksheet('Validation Errors');
    expect(validationSheet?.getRow(1).getCell(1).value).toBe('Row Number');
    expect(validationSheet?.getRow(2).getCell(3).value).toBe('001245@almodawat.sa');
    expect(validationSheet?.getRow(2).getCell(4).value).toBe('aisha@example.test');
    expect(validationSheet?.getRow(2).getCell(7).value).toBe('update');
    expect(validationSheet?.getRow(2).getCell(8).value).toBe('Aisha Example (001245@almodawat.sa)');
    expect(validationSheet?.getRow(2).getCell(9).value).toBe('001245@almodawat.sa');
    expect(validationSheet?.getRow(2).getCell(11).value).toBe('Example validation error.');
    expect(validationSheet?.getRow(2).getCell(12).value).toBe('Example validation warning.');
  });
});
