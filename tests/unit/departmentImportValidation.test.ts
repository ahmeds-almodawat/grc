import { describe, it, expect } from 'vitest';
import { validateImportText, RefData } from '../../src/utils/departmentImportValidation';

describe('departmentImportValidation', () => {
  const mockRefData: RefData = {
    orgs: new Set(['ORG1']),
    divs: new Set(['ORG1|DIV1']),
    depts: new Set(['ORG1|DIV1|DEPT1', 'ORG1||DEPT2']), // DEPT1 has division, DEPT2 has null division
    managers: new Map([
      ['active@example.com', { user_status: 'active', organization_code: 'ORG1' }],
      ['inactive@example.com', { user_status: 'inactive', organization_code: 'ORG1' }],
      ['outside@example.com', { user_status: 'active', organization_code: 'ORG2' }]
    ])
  };

  it('validates a correct create-only row', () => {
    const csv = `organization_code,division_code,department_code,department_name_en,status
ORG1,DIV1,NEW_DEPT,New Department,active`;
    const result = validateImportText(csv, mockRefData);
    expect(result.validRows).toBe(1);
    expect(result.invalidRows).toBe(0);
    expect(result.errorsByRow[1]).toBeUndefined();
  });

  it('detects duplicate composite department identity in file', () => {
    const csv = `organization_code,division_code,department_code,department_name_en
ORG1,DIV1,NEW_DEPT,Dept 1
ORG1,DIV1,NEW_DEPT,Dept 2`;
    const result = validateImportText(csv, mockRefData);
    expect(result.validRows).toBe(1);
    expect(result.invalidRows).toBe(1);
    expect(result.errorsByRow[2][0]).toMatch(/Duplicate department code/);
  });

  it('detects existing department in database (composite key)', () => {
    const csv = `organization_code,division_code,department_code,department_name_en
ORG1,DIV1,DEPT1,Existing Dept
ORG1,,DEPT2,Existing Null Div Dept`;
    const result = validateImportText(csv, mockRefData);
    expect(result.validRows).toBe(0);
    expect(result.invalidRows).toBe(2);
    expect(result.errorsByRow[1][0]).toMatch(/Department already exists/);
    expect(result.errorsByRow[2][0]).toMatch(/Department already exists/);
  });

  it('validates unknown organization', () => {
    const csv = `organization_code,division_code,department_code,department_name_en
UNKNOWN_ORG,DIV1,NEW_DEPT,Dept`;
    const result = validateImportText(csv, mockRefData);
    expect(result.errorsByRow[1][0]).toMatch(/Unknown organization: UNKNOWN_ORG/);
  });

  it('validates missing manager, inactive manager, and out-of-scope manager', () => {
    const csv = `organization_code,department_code,department_name_en,manager_email
ORG1,D1,Dept1,missing@example.com
ORG1,D2,Dept2,inactive@example.com
ORG1,D3,Dept3,outside@example.com`;
    const result = validateImportText(csv, mockRefData);
    expect(result.errorsByRow[1][0]).toMatch(/Unknown manager email/);
    expect(result.errorsByRow[2][0]).toMatch(/Manager is not active/);
    expect(result.errorsByRow[3][0]).toMatch(/Manager outside organization/);
  });

  it('validates invalid status', () => {
    const csv = `organization_code,department_code,department_name_en,status
ORG1,D1,Dept1,archived`;
    const result = validateImportText(csv, mockRefData);
    expect(result.errorsByRow[1][0]).toMatch(/Unsupported status/);
  });

  it('sanitizes formula-injection', () => {
    const csv = `organization_code,department_code,department_name_en
ORG1,=CMD,Dept
ORG1,+ADD,Dept
ORG1,-SUB,Dept
ORG1,@EVAL,Dept`;
    const result = validateImportText(csv, mockRefData);
    expect(result.rows[0].department_code).toBe("'=CMD");
    expect(result.rows[1].department_code).toBe("'+ADD");
    expect(result.rows[2].department_code).toBe("'-SUB");
    expect(result.rows[3].department_code).toBe("'@EVAL");
  });

  it('rejects duplicate headers', () => {
    const csv = `organization_code,organization_code,department_code,department_name_en
ORG1,ORG1,DEPT,Dept`;
    const result = validateImportText(csv, mockRefData);
    expect(result.errorsByRow[0]).toBeDefined();
    expect(result.errorsByRow[0][0]).toMatch(/Duplicate headers found: organization_code/);
  });
});
