export interface ImportValidationResult {
  headers: string[];
  rows: Record<string, string>[];
  errorsByRow: Record<number, string[]>;
  validRows: number;
  invalidRows: number;
}

export interface RefData {
  orgs: Set<string>;
  divs: Set<string>;
  depts: Set<string>;
  archivedDeptKeys?: Set<string>;
  managers: Map<string, any>;
}

export function parseDelimitedText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map(h => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, index) => {
      row[h] = values[index] || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

export function validateImportText(text: string, refData?: RefData | null): ImportValidationResult {
  // Check file size (rough estimate of 5MB)
  if (new Blob([text]).size > 5242880) {
    return { headers: [], rows: [], errorsByRow: { 0: ['File exceeds maximum size of 5MB'] }, validRows: 0, invalidRows: 0 };
  }

  const { headers, rows } = parseDelimitedText(text);

  if (rows.length > 5000) {
    return { headers, rows, errorsByRow: { 0: ['File exceeds maximum 5000 rows'] }, validRows: 0, invalidRows: 0 };
  }

  const acceptedColumns = ['organization_code', 'division_code', 'department_code', 'department_name_en', 'department_name_ar', 'department_type', 'manager_email', 'status'];
  const required = ['organization_code', 'department_code', 'department_name_en'];

  const errorsByRow: Record<number, string[]> = {};

  // Duplicate headers check
  const headerSet = new Set<string>();
  const duplicateHeaders = new Set<string>();
  headers.forEach(h => {
    if (headerSet.has(h)) duplicateHeaders.add(h);
    headerSet.add(h);
  });

  if (duplicateHeaders.size > 0) {
    errorsByRow[0] = [`Duplicate headers found: ${Array.from(duplicateHeaders).join(', ')}`];
  }

  const missingHeaders = required.filter(req => !headers.includes(req));
  const invalidHeaders = headers.filter(h => !acceptedColumns.includes(h));

  if (missingHeaders.length) {
    errorsByRow[0] = [...(errorsByRow[0] || []), `Missing required columns: ${missingHeaders.join(', ')}`];
  }
  if (invalidHeaders.length) {
    errorsByRow[0] = [...(errorsByRow[0] || []), `Unsupported columns found: ${invalidHeaders.join(', ')}`];
  }

  const seenCompositeKeys = new Set<string>();

  rows.forEach((row, index) => {
    // Blank row handling
    if (Object.values(row).every(v => !v.trim())) {
      errorsByRow[index + 1] = ['Row is completely empty'];
      return;
    }

    required.forEach(req => {
      if (!row[req]?.trim()) {
        errorsByRow[index + 1] = [...(errorsByRow[index + 1] || []), `${req} is required`];
      }
    });

    Object.keys(row).forEach(k => {
      let val = row[k] || '';
      // Formula-injection sanitization
      if (['=', '+', '-', '@'].includes(val.charAt(0))) {
        row[k] = "'" + val;
      }
    });

    const orgCode = row['organization_code']?.trim().toUpperCase();
    const divCode = row['division_code']?.trim().toUpperCase();
    const code = row['department_code']?.trim().toUpperCase();
    const managerEmail = row['manager_email']?.trim().toLowerCase();
    const nameEn = row['department_name_en']?.trim().replace(/\s+/g, ' ').toLowerCase();
    const nameAr = row['department_name_ar']?.trim().replace(/\s+/g, ' ').toLowerCase();
    const status = row['status']?.trim().toLowerCase();

    if (status && !['active', 'inactive'].includes(status)) {
       errorsByRow[index + 1] = [...(errorsByRow[index + 1] || []), `Unsupported status: ${status}`];
    }

    if (orgCode && code) {
      // Use composite matching key: orgCode + '|' + code
      const compositeKey = `${orgCode}|${code}`;
      if (seenCompositeKeys.has(compositeKey)) {
        errorsByRow[index + 1] = [...(errorsByRow[index + 1] || []), `Duplicate department code in file: ${code} (under org ${orgCode})`];
      } else {
        seenCompositeKeys.add(compositeKey);
      }
    }

    if (refData) {
      if (orgCode && !refData.orgs.has(orgCode)) {
        errorsByRow[index + 1] = [...(errorsByRow[index + 1] || []), `Unknown organization: ${orgCode}`];
      }
      if (divCode && orgCode && !refData.divs.has(`${orgCode}|${divCode}`)) {
        errorsByRow[index + 1] = [...(errorsByRow[index + 1] || []), `Unknown division: ${divCode}`];
      }
      const archivedMatch = Boolean(orgCode && (
        (code && refData.archivedDeptKeys?.has(`${orgCode}|CODE|${code}`))
        || (nameEn && refData.archivedDeptKeys?.has(`${orgCode}|NAME|${nameEn}`))
        || (nameAr && refData.archivedDeptKeys?.has(`${orgCode}|NAME|${nameAr}`))
      ));
      if (archivedMatch) {
        errorsByRow[index + 1] = [...(errorsByRow[index + 1] || []),
          'archived_department_match: restore the matching department from Department Management before importing'];
      } else if (orgCode && code && refData.depts.has(`${orgCode}|${code}`)) {
        errorsByRow[index + 1] = [...(errorsByRow[index + 1] || []), `Department already exists in database: ${code}`];
      }
      if (managerEmail) {
        const profile = refData.managers.get(managerEmail);
        if (!profile) {
          errorsByRow[index + 1] = [...(errorsByRow[index + 1] || []), `Unknown manager email: ${managerEmail}`];
        } else if (profile.user_status !== 'active') {
          errorsByRow[index + 1] = [...(errorsByRow[index + 1] || []), `Manager is not active: ${managerEmail}`];
        } else if (orgCode && profile.organization_code && profile.organization_code !== orgCode) {
          errorsByRow[index + 1] = [...(errorsByRow[index + 1] || []), `Manager outside organization: ${managerEmail}`];
        }
      }
    }
  });

  const validRows = rows.filter((_, idx) => !errorsByRow[idx + 1]).length;
  const invalidRows = rows.length - validRows;
  return { headers, rows, errorsByRow, validRows, invalidRows };
}
