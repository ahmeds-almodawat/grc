import { describe, expect, it } from 'vitest';
import { classifyUserImportDepartment, type DepartmentLookup } from '../../src/lib/userManagementApi';

describe('department lifecycle assignment validation', () => {
  const active: DepartmentLookup[] = [{ id: 'active', code: 'IT', name_en: 'Information Technology', name_ar: 'تقنية المعلومات' }];
  const archived: DepartmentLookup[] = [{ id: 'archived', code: 'OLD', name_en: 'Old Department', name_ar: 'القسم القديم' }];

  it('keeps active departments eligible for User Import', () => {
    expect(classifyUserImportDepartment(' it ', active, archived)).toEqual({ status: 'active', department: active[0] });
  });

  it('rejects archived User Import departments by code and normalized name', () => {
    expect(classifyUserImportDepartment('OLD', active, archived).status).toBe('archived');
    expect(classifyUserImportDepartment('  Old   Department ', active, archived).status).toBe('archived');
    expect(classifyUserImportDepartment('القسم القديم', active, archived).status).toBe('archived');
  });

  it('does not silently map unknown departments', () => {
    expect(classifyUserImportDepartment('UNKNOWN', active, archived)).toEqual({ status: 'unknown', department: null });
  });
});
