import type { Cell, Workbook } from 'exceljs';
import {
  ALLOWED_DEPARTMENT_STATUSES,
  ALLOWED_DEPARTMENT_TYPES,
  DEPARTMENT_IMPORT_ORGANIZATION_CODE,
  DEPARTMENT_IMPORT_COLUMNS,
  createNormalizedDepartmentImportRow,
  type DepartmentImportColumn,
  type NormalizedDepartmentImportRow,
} from './departmentImportValidation';

const MAX_WORKBOOK_SIZE = 5 * 1024 * 1024;
const MAX_HEADER_COLUMNS = 64;

export interface DepartmentWorkbookFile {
  name: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface DepartmentWorkbookParseResult {
  headers: string[];
  rows: NormalizedDepartmentImportRow[];
  errorsByRow: Record<number, string[]>;
}

export interface DepartmentImportFileState {
  file: { name: string; size: number } | null;
  validation: null;
  parseError: string | null;
  parsing: boolean;
}

export function createDepartmentImportFileState(file?: Pick<DepartmentWorkbookFile, 'name' | 'size'>): DepartmentImportFileState {
  return {
    file: file ? { name: file.name, size: file.size } : null,
    validation: null,
    parseError: null,
    parsing: Boolean(file),
  };
}

export class DepartmentWorkbookError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'DepartmentWorkbookError';
  }
}

function addError(errorsByRow: Record<number, string[]>, rowNumber: number, message: string) {
  errorsByRow[rowNumber] = [...(errorsByRow[rowNumber] ?? []), message];
}

function isFormulaCell(cell: Cell) {
  const value = cell.value;
  return Boolean(
    value
    && typeof value === 'object'
    && ('formula' in value || 'sharedFormula' in value),
  );
}

function plainTextValue(cell: Cell, rowNumber: number, columnName: string, errorsByRow: Record<number, string[]>) {
  if (cell.value === null || cell.value === undefined) return '';
  if (isFormulaCell(cell)) {
    addError(errorsByRow, rowNumber, `Formula cells are not allowed (${columnName}).`);
    return '';
  }
  if (typeof cell.value === 'string') return cell.value.trim();
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

async function loadWorkbook(bytes: ArrayBuffer): Promise<Workbook> {
  const { default: ExcelJS } = await import('exceljs/dist/exceljs.min.js');
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes);
  } catch {
    throw new DepartmentWorkbookError(
      'CORRUPT_WORKBOOK',
      'The selected file is corrupt or is not a valid Excel .xlsx workbook.',
    );
  }
  return workbook;
}

export async function parseDepartmentWorkbook(
  file: DepartmentWorkbookFile,
): Promise<DepartmentWorkbookParseResult> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new DepartmentWorkbookError(
      'UNSUPPORTED_FILE_TYPE',
      'Unsupported file type. Upload an Excel .xlsx workbook; CSV and legacy .xls files are not accepted.',
    );
  }
  if (file.size <= 0) {
    throw new DepartmentWorkbookError('EMPTY_WORKBOOK', 'The selected workbook is empty.');
  }
  if (file.size > MAX_WORKBOOK_SIZE) {
    throw new DepartmentWorkbookError('WORKBOOK_TOO_LARGE', 'The workbook exceeds the 5 MB size limit.');
  }

  const workbook = await loadWorkbook(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new DepartmentWorkbookError('EMPTY_WORKBOOK', 'The workbook does not contain a worksheet.');
  }

  const headerRow = worksheet.getRow(1);
  const headerColumnCount = headerRow.cellCount;
  if (!headerColumnCount) {
    throw new DepartmentWorkbookError('EMPTY_WORKBOOK', 'The first worksheet does not contain a header row.');
  }
  if (headerColumnCount > MAX_HEADER_COLUMNS) {
    throw new DepartmentWorkbookError('UNSUPPORTED_COLUMNS', 'The workbook contains too many columns.');
  }

  const errorsByRow: Record<number, string[]> = {};
  const headers: string[] = [];
  for (let columnNumber = 1; columnNumber <= headerColumnCount; columnNumber += 1) {
    headers.push(plainTextValue(headerRow.getCell(columnNumber), 0, `column ${columnNumber} header`, errorsByRow));
  }

  const rows: NormalizedDepartmentImportRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (worksheetRow, rowNumber) => {
    if (rowNumber === 1) return;
    if (rows.length >= 5000) {
      throw new DepartmentWorkbookError(
        'WORKBOOK_TOO_MANY_ROWS',
        'The workbook exceeds the maximum of 5,000 data rows.',
      );
    }
    let hasUsableCell = false;
    worksheetRow.eachCell({ includeEmpty: false }, (cell) => {
      if (isFormulaCell(cell) || (
        cell.value !== null
        && cell.value !== undefined
        && String(cell.text ?? '').trim()
      )) hasUsableCell = true;
      if (cell.fullAddress.col > headerColumnCount) {
        addError(errorsByRow, rowNumber, `Row contains data outside the declared header columns (column ${cell.fullAddress.col}).`);
      }
    });
    if (!hasUsableCell) return;

    const rawData: Partial<Record<DepartmentImportColumn, string>> = {};
    headers.forEach((header, index) => {
      if (!DEPARTMENT_IMPORT_COLUMNS.includes(header as DepartmentImportColumn)) return;
      rawData[header as DepartmentImportColumn] = plainTextValue(
        worksheetRow.getCell(index + 1),
        rowNumber,
        header,
        errorsByRow,
      );
    });
    rows.push(createNormalizedDepartmentImportRow(rowNumber, rawData));
  });

  return { headers, rows, errorsByRow };
}

export async function createDepartmentImportTemplate(): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs/dist/exceljs.min.js');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GRC Control Center';
  workbook.created = new Date(0);

  const worksheet = workbook.addWorksheet('Departments', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  worksheet.addRow([...DEPARTMENT_IMPORT_COLUMNS]);
  worksheet.addRow([
    DEPARTMENT_IMPORT_ORGANIZATION_CODE,
    'MED',
    'NUR',
    'Nursing',
    'التمريض',
    'clinical',
    'nursing.manager@almodawat.sa',
    'active',
  ]);
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' },
  };
  worksheet.autoFilter = { from: 'A1', to: 'H2' };
  [22, 18, 20, 28, 28, 22, 34, 16].forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
  for (let rowNumber = 2; rowNumber <= 5001; rowNumber += 1) {
    worksheet.getCell(`F${rowNumber}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`"${ALLOWED_DEPARTMENT_TYPES.join(',')}"`],
    };
    worksheet.getCell(`H${rowNumber}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`"${ALLOWED_DEPARTMENT_STATUSES.join(',')}"`],
    };
  }

  const instructions = workbook.addWorksheet('Instructions');
  instructions.getColumn(1).width = 110;
  instructions.addRows([
    ['Department Import Instructions'],
    ['Complete the Departments worksheet. Do not rename, duplicate, add, or remove columns.'],
    ['Required: organization_code, department_code, department_name_en, department_name_ar, department_type, status.'],
    ['Optional: division_code, manager_email.'],
    [`department_type values: ${ALLOWED_DEPARTMENT_TYPES.join(', ')}`],
    [`status values: ${ALLOWED_DEPARTMENT_STATUSES.join(', ')}`],
    ['Use plain text only. Formula cells, CSV files, and legacy .xls files are rejected.'],
    ['Previewing validates the workbook and does not modify data.'],
  ]);
  instructions.getRow(1).font = { bold: true, size: 14 };

  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = buffer instanceof ArrayBuffer
    ? new Uint8Array(buffer)
    : new Uint8Array(buffer as unknown as ArrayBuffer);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
