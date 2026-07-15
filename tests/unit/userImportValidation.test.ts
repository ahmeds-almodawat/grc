import { describe, expect, it } from 'vitest';
import { normalizeSaudiPhone, validateUserImportRows } from '../../src/utils/userImportValidation';
import { deriveSyntheticAuthEmail } from '../../src/utils/userWorkbook';
import type { ParsedUserImportRow } from '../../src/utils/userWorkbook';

const references = {
  users: [
    { user_id: 'user-a', employee_no: '001245', full_name_en: 'Existing A', email: '001245@almodawat.sa' },
    { user_id: 'user-b', employee_no: 'EMP-00002', full_name_en: 'Existing B', email: 'emp-00002@almodawat.sa' },
  ],
  authIdentities: [
    { auth_user_id: 'user-a', profile_user_id: 'user-a', email: '001245@almodawat.sa' },
    { auth_user_id: 'user-b', profile_user_id: 'user-b', email: 'emp-00002@almodawat.sa' },
  ],
  openProvisioningIdentities: [],
  actorIsSuperAdmin: true,
  activeDepartments: [
    { id: 'department-it', code: 'IT', name_en: 'Information Technology', name_ar: 'تقنية المعلومات', division_id: 'division-1' },
  ],
  archivedDepartments: [
    { id: 'department-old', code: 'OLD', name_en: 'Archived Department', name_ar: 'إدارة مؤرشفة', division_id: 'division-1' },
  ],
};

function row(overrides: Partial<ParsedUserImportRow> = {}): ParsedUserImportRow {
  return {
    row_number: 2,
    employee_no: 'NEW-001',
    full_name_en: 'New User',
    full_name_ar: 'مستخدم جديد',
    contact_email: 'new.user@example.test',
    synthetic_auth_email: 'new-001@almodawat.sa',
    phone_original: '0501234567',
    phone_normalized: null,
    department: 'IT',
    job_title: 'Analyst',
    role: 'employee',
    role_scope: 'assigned_only',
    status: 'active',
    user_type: 'employee',
    account_action: 'create_or_update',
    ...overrides,
  };
}

describe('Patch 83T Saudi phone normalization', () => {
  it.each([
    '0501234567',
    '966501234567',
    '00966501234567',
    '+966501234567',
  ])('normalizes %s without numeric coercion', (value) => {
    expect(normalizeSaudiPhone(value)).toBe('+966501234567');
  });

  it.each(['501234567', '050123456', '+966401234567', '0096650123456', '05 0123 4567'])('rejects %s', (value) => {
    expect(normalizeSaudiPhone(value)).toBeNull();
  });
});

describe('Patch 83T User import validation', () => {
  it('plans an exact profile update and a protected provisioning record without browser Auth creation', () => {
    const result = validateUserImportRows([
      row({ employee_no: '001245', contact_email: 'changed.contact@example.test', account_action: 'update' }),
      row({ row_number: 3, employee_no: 'NEW-002', contact_email: '', account_action: 'create' }),
    ], references);

    expect(result).toMatchObject({
      rowCount: 2,
      validCount: 2,
      invalidCount: 0,
      existingUserUpdateCount: 1,
      pendingAccountCreationCount: 1,
    });
    expect(result.rows[0]).toMatchObject({
      matched_user_id: 'user-a',
      matched_auth_user_id: 'user-a',
      synthetic_auth_email: '001245@almodawat.sa',
      planned_action: 'update_existing_profile',
      phone_normalized: '+966501234567',
    });
    expect(result.rows[1].planned_action).toBe('pending_account_creation');
    expect(result.rows[1].validation_warnings?.join(' ')).toContain('no Supabase Auth account will be created');
  });

  it('rejects an Employee ID and synthetic Auth email that resolve to different profiles', () => {
    const result = validateUserImportRows([
      row({ employee_no: '001245', account_action: 'update' }),
    ], {
      ...references,
      users: [
        { user_id: 'user-a', employee_no: '001245', full_name_en: 'Existing A', email: 'legacy.a@example.test' },
        { user_id: 'user-b', employee_no: 'EMP-00002', full_name_en: 'Existing B', email: '001245@almodawat.sa' },
      ],
      authIdentities: [],
    });
    expect(result.invalidCount).toBe(1);
    expect(result.rows[0]).toMatchObject({ planned_action: 'rejected', matched_user_id: null });
    expect(result.rows[0].validation_errors).toContain(
      'Employee ID and synthetic Auth email resolve to different existing profiles. Resolve the identity conflict before importing.',
    );
  });

  it('rejects distinct rows that resolve to the same existing profile', () => {
    const result = validateUserImportRows([
      row({ employee_no: '001245', account_action: 'update' }),
      row({ row_number: 3, employee_no: 'legacy-login', account_action: 'update' }),
    ], {
      ...references,
      users: [{ user_id: 'user-a', employee_no: '001245', full_name_en: 'Existing A', email: 'legacy-login@almodawat.sa' }],
      authIdentities: [],
    });

    expect(result).toMatchObject({ validCount: 0, invalidCount: 2, existingUserUpdateCount: 0 });
    expect(result.rows.every((item) => item.planned_action === 'rejected')).toBe(true);
    expect(result.rows[0].validation_errors).toContain(
      'Multiple workbook rows resolve to the same existing user. Keep only one row per existing profile.',
    );
    expect(result.rows[1].validation_errors).toContain(
      'Multiple workbook rows resolve to the same existing user. Keep only one row per existing profile.',
    );
  });

  it('rejects ambiguous existing Employee IDs even when the synthetic Auth email identifies one profile', () => {
    const result = validateUserImportRows([
      row({ employee_no: '001245', account_action: 'update' }),
    ], {
      ...references,
      users: [
        ...references.users,
        { user_id: 'user-c', employee_no: '001245', full_name_en: 'Existing C', email: 'user-c@almodawat.sa' },
      ],
    });
    expect(result.rows[0].validation_errors).toContain(
      'Ambiguous Employee ID: more than one existing profile has this Employee ID.',
    );
    expect(result.rows[0].planned_action).toBe('rejected');
  });

  it('marks every row affected by duplicate Employee IDs while treating contact email as non-identity data', () => {
    const result = validateUserImportRows([
      row({ employee_no: 'DUP-001', contact_email: 'DUP@example.test' }),
      row({ row_number: 3, employee_no: 'DUP-001', contact_email: 'dup@example.test' }),
    ], references);
    expect(result).toMatchObject({
      invalidCount: 2,
      duplicateEmployeeIdCount: 2,
      duplicateContactEmailCount: 2,
    });
    expect(result.rows.every((item) => item.planned_action === 'rejected')).toBe(true);
  });

  it('preserves Employee ID text while rejecting a case-insensitive Auth alias collision', () => {
    const result = validateUserImportRows([
      row({ employee_no: '  EMP-00125  ', contact_email: 'one@example.test' }),
      row({ row_number: 3, employee_no: 'emp-00125', contact_email: 'two@example.test' }),
    ], references);
    expect(result.duplicateEmployeeIdCount).toBe(0);
    expect(result.invalidCount).toBe(2);
    expect(result.rows.map((item) => item.employee_no)).toEqual(['EMP-00125', 'emp-00125']);
    expect(result.rows[0].validation_errors).toContain(
      'Employee IDs must also be unique case-insensitively because they produce the same authentication email.',
    );
  });

  it('strictly rejects unknown role, scope, status, and user type without defaulting', () => {
    const result = validateUserImportRows([
      row({ role: 'Governance Admin', role_scope: 'division', status: 'Active', user_type: 'mystery' }),
    ], references);
    expect(result).toMatchObject({ invalidCount: 1, unknownRoleCount: 1 });
    expect(result.rows[0].validation_errors).toEqual(expect.arrayContaining([
      'Unknown role. Use an exact supported app role value.',
      'Invalid role scope. Use global, department, or assigned_only exactly; division and unit are not supported by this import.',
      'Invalid status. Use an exact supported status value.',
      'Invalid user type. Use an exact supported user_type value.',
    ]));
    expect(result.rows[0].user_type).toBe('mystery');
  });

  it('requires Employee ID and required fields, with conditional Arabic-name handling', () => {
    const employee = validateUserImportRows([
      row({ employee_no: '', full_name_ar: '' }),
    ], references);
    expect(employee.rows[0].validation_errors).toEqual(expect.arrayContaining([
      'Employee ID is required.',
      'Arabic name is required for employee users.',
    ]));

    const vendor = validateUserImportRows([
      row({ employee_no: 'VEN-001', full_name_ar: '', user_type: 'vendor' }),
    ], references);
    expect(vendor.invalidCount).toBe(0);
  });

  it('accepts blank contact email and validates contact email only when populated', () => {
    const blank = validateUserImportRows([
      row({ employee_no: '11111', contact_email: '', account_action: 'create' }),
    ], references);
    const populated = validateUserImportRows([
      row({ employee_no: 'NEW-CONTACT', contact_email: 'person@example.test', account_action: 'create' }),
    ], references);
    const invalid = validateUserImportRows([
      row({ employee_no: 'NEW-BAD-CONTACT', contact_email: 'not-an-email', account_action: 'create' }),
    ], references);

    expect(blank).toMatchObject({ validCount: 1, invalidCount: 0 });
    expect(blank.rows[0]).toMatchObject({
      employee_no: '11111',
      synthetic_auth_email: '11111@almodawat.sa',
      contact_email: '',
      planned_action: 'pending_account_creation',
    });
    expect(populated.invalidCount).toBe(0);
    expect(invalid.rows[0].validation_errors).toContain(
      'Contact email must be a valid email address when populated.',
    );
  });

  it('keeps contact email distinct from identity matching and allows shared contact mailboxes', () => {
    const result = validateUserImportRows([
      row({ employee_no: 'NEW-SHARED-1', contact_email: 'TEAM@example.test', account_action: 'create' }),
      row({ row_number: 3, employee_no: 'NEW-SHARED-2', contact_email: 'team@example.test', account_action: 'create' }),
    ], references);

    expect(result).toMatchObject({ validCount: 2, invalidCount: 0, duplicateContactEmailCount: 2 });
    expect(result.rows.map((item) => item.synthetic_auth_email)).toEqual([
      'new-shared-1@almodawat.sa',
      'new-shared-2@almodawat.sa',
    ]);
    expect(result.rows.every((item) => item.planned_action === 'pending_account_creation')).toBe(true);
  });

  it('preserves 001245 and derives the synthetic Auth email without numeric coercion', () => {
    expect(deriveSyntheticAuthEmail('001245')).toBe('001245@almodawat.sa');
    expect(deriveSyntheticAuthEmail('EMP-00125')).toBe('emp-00125@almodawat.sa');

    const result = validateUserImportRows([
      row({ employee_no: '001245', contact_email: 'different.contact@example.test', account_action: 'update' }),
    ], references);
    expect(result.invalidCount).toBe(0);
    expect(result.rows[0]).toMatchObject({
      employee_no: '001245',
      synthetic_auth_email: '001245@almodawat.sa',
      matched_user_id: 'user-a',
    });
  });

  it.each([
    'EMP 001',
    'موظف',
    'bad@id',
    'bad+id',
    'bad/id',
  ])('rejects unsupported Employee ID characters in %s', (employeeNo) => {
    const result = validateUserImportRows([
      row({ employee_no: employeeNo, contact_email: '', account_action: 'create' }),
    ], references);
    expect(result.rows[0].validation_errors).toContain(
      'Employee ID may contain only letters, digits, period, underscore, and hyphen, with a maximum length of 64 characters.',
    );
  });

  it.each(['.EMP', 'EMP.', 'EMP..001'])(
    'accepts period placement without silently rewriting the allowed Employee ID %s',
    (employeeNo) => {
      const result = validateUserImportRows([
        row({ employee_no: employeeNo, contact_email: '', account_action: 'create' }),
      ], references);
      expect(result.invalidCount).toBe(0);
      expect(result.rows[0].employee_no).toBe(employeeNo);
    },
  );

  it('requires an exact account_action and never defaults a missing or case-changed value', () => {
    const missing = validateUserImportRows([row({ account_action: '' })], references);
    const caseChanged = validateUserImportRows([row({ account_action: 'Create' })], references);

    expect(missing.rows[0]).toMatchObject({ planned_action: 'rejected' });
    expect(missing.rows[0].validation_errors).toContain('Account action is required.');
    expect(caseChanged.rows[0]).toMatchObject({ planned_action: 'rejected' });
    expect(caseChanged.rows[0].validation_errors).toContain(
      'Invalid account action. Use create, update, or create_or_update exactly.',
    );
  });

  it('enforces create, update, and create_or_update planning against current profiles', () => {
    const createExisting = validateUserImportRows([
      row({ employee_no: '001245', account_action: 'create' }),
    ], references);
    const updateUnknown = validateUserImportRows([
      row({ employee_no: 'UNKNOWN-UPDATE', account_action: 'update' }),
    ], references);
    const updateExisting = validateUserImportRows([
      row({ employee_no: '001245', account_action: 'update' }),
    ], references);
    const upsertUnknown = validateUserImportRows([
      row({ employee_no: 'UNKNOWN-UPSERT', account_action: 'create_or_update' }),
    ], references);

    expect(createExisting.rows[0].validation_errors).toContain(
      'account_action create is not allowed because an existing profile matches this identity.',
    );
    expect(updateUnknown.rows[0].validation_errors).toContain(
      'account_action update requires exactly one existing profile match and never creates an account or provisioning record.',
    );
    expect(updateExisting.rows[0]).toMatchObject({
      validation_status: 'valid',
      planned_action: 'update_existing_profile',
      matched_user_id: 'user-a',
    });
    expect(upsertUnknown.rows[0]).toMatchObject({
      validation_status: 'valid',
      planned_action: 'pending_account_creation',
      matched_user_id: null,
    });
  });

  it('rejects create collisions with orphan Auth and open provisioning identities', () => {
    const authCollision = validateUserImportRows([
      row({ employee_no: 'AUTH-ONLY', account_action: 'create' }),
    ], {
      ...references,
      authIdentities: [{ auth_user_id: 'auth-only-id', email: 'auth-only@almodawat.sa' }],
    });
    const provisioningCollision = validateUserImportRows([
      row({ employee_no: 'PROVISION-ONLY', account_action: 'create' }),
    ], {
      ...references,
      openProvisioningIdentities: [{
        provisioning_id: 'provisioning-1',
        employee_no: 'PROVISION-ONLY',
        auth_email: 'provision-only@almodawat.sa',
        state: 'queued',
      }],
    });

    expect(authCollision.rows[0]).toMatchObject({
      planned_action: 'rejected',
      matched_auth_user_id: 'auth-only-id',
      matched_auth_identity_label: 'auth-only@almodawat.sa',
    });
    expect(authCollision.rows[0].validation_errors).toContain(
      'account_action create is not allowed because the synthetic Auth identity already exists.',
    );
    expect(provisioningCollision.rows[0]).toMatchObject({
      planned_action: 'rejected',
      matched_provisioning_id: 'provisioning-1',
    });
    expect(provisioningCollision.rows[0].validation_errors).toContain(
      'account_action create is not allowed because an open provisioning identity already exists.',
    );
  });

  it('makes create_or_update fail closed for orphan Auth and open provisioning identities', () => {
    const result = validateUserImportRows([
      row({ employee_no: 'ORPHAN-ID', account_action: 'create_or_update' }),
    ], {
      ...references,
      authIdentities: [{ auth_user_id: 'orphan-auth', email: 'orphan-id@almodawat.sa' }],
      openProvisioningIdentities: [{
        provisioning_id: 'orphan-provisioning',
        employee_no: 'ORPHAN-ID',
        auth_email: 'orphan-id@almodawat.sa',
        state: 'reconciliation_required',
      }],
    });

    expect(result.rows[0]).toMatchObject({ planned_action: 'rejected' });
    expect(result.rows[0].validation_errors).toEqual(expect.arrayContaining([
      'account_action create_or_update cannot create because the synthetic Auth identity exists without one exact profile match; reconcile it first.',
      'account_action create_or_update cannot create a duplicate open provisioning identity; reconcile the existing record first.',
    ]));
  });

  it('rejects archived and unknown departments with explicit restore guidance', () => {
    const result = validateUserImportRows([
      row({ department: 'OLD' }),
      row({ row_number: 3, employee_no: 'NEW-003', contact_email: 'three@example.test', department: 'MISSING' }),
    ], references);
    expect(result).toMatchObject({ invalidCount: 2, unknownDepartmentCount: 1 });
    expect(result.rows[0].validation_errors?.join(' ')).toContain('Restore it explicitly from Department Management');
    expect(result.rows[1].validation_errors).toContain('Unknown active department code.');
  });

  it('previews active role assignments that authoritative execution will deactivate', () => {
    const result = validateUserImportRows([
      row({ employee_no: '001245', contact_email: 'existing.a@example.test', role: 'viewer', role_scope: 'assigned_only' }),
    ], {
      ...references,
      users: references.users.map((user) => user.user_id === 'user-a'
        ? {
            ...user,
            organization_id: 'organization-1',
            roles: [
              { user_role_id: 'role-super', role: 'super_admin', scope: 'global', organization_id: 'organization-1', department_id: null, is_active: true },
              { user_role_id: 'role-viewer', role: 'viewer', scope: 'assigned_only', organization_id: 'organization-1', department_id: null, is_active: true },
            ],
          }
        : user),
    });

    expect(result.invalidCount).toBe(0);
    expect(result.rows[0].validation_warnings?.join(' ')).toContain(
      'Execution will deactivate these non-matching active assignments: super_admin (global).',
    );
    expect(result.rows[0].matched_active_role_ids).toEqual(['role-super', 'role-viewer']);
  });

  it.each([
    ['super_admin', 'global'],
    ['executive', 'global'],
    ['governance_admin', 'global'],
    ['auditor', 'global'],
    ['compliance_officer', 'global'],
    ['department_manager', 'department'],
    ['project_owner', 'assigned_only'],
    ['milestone_owner', 'assigned_only'],
    ['task_owner', 'assigned_only'],
    ['viewer', 'assigned_only'],
    ['employee', 'assigned_only'],
  ] as const)('accepts the canonical %s / %s import pairing', (role, roleScope) => {
    const result = validateUserImportRows([
      row({ role, role_scope: roleScope }),
    ], references);

    expect(result.invalidCount).toBe(0);
    expect(result.rows[0].planned_action).not.toBe('rejected');
  });

  it.each(['super_admin', 'executive', 'governance_admin'] as const)(
    'rejects %s assignment during preview when the actor is not a global Super Admin',
    (role) => {
      const result = validateUserImportRows([
        row({ role, role_scope: 'global' }),
      ], { ...references, actorIsSuperAdmin: false });

      expect(result.invalidCount).toBe(1);
      expect(result.rows[0].validation_errors).toContain(
        'Only an organization-aligned global Super Admin may import Super Admin, Executive, or Governance Admin access.',
      );
    },
  );

  it('rejects privileged-role replacement when the importing actor is not a global Super Admin', () => {
    const result = validateUserImportRows([
      row({ employee_no: '001245', account_action: 'update', role: 'viewer', role_scope: 'assigned_only' }),
    ], {
      ...references,
      actorIsSuperAdmin: false,
      users: references.users.map((user) => user.user_id === 'user-a'
        ? {
            ...user,
            organization_id: 'organization-1',
            roles: [{
              user_role_id: 'privileged-role',
              role: 'governance_admin',
              scope: 'global',
              organization_id: 'organization-1',
              department_id: null,
              is_active: true,
            }],
          }
        : user),
    });

    expect(result.rows[0]).toMatchObject({ validation_status: 'error', planned_action: 'rejected' });
    expect(result.rows[0].validation_errors).toContain(
      'Only an organization-aligned global Super Admin may replace or deactivate an existing privileged role assignment.',
    );
  });

  it.each([
    ['super_admin', 'department'],
    ['executive', 'assigned_only'],
    ['governance_admin', 'department'],
    ['auditor', 'assigned_only'],
    ['compliance_officer', 'department'],
    ['department_manager', 'assigned_only'],
    ['project_owner', 'global'],
    ['milestone_owner', 'department'],
    ['task_owner', 'global'],
    ['viewer', 'department'],
    ['employee', 'global'],
    ['division_head', 'global'],
  ] as const)('rejects the non-canonical %s / %s import pairing', (role, roleScope) => {
    const result = validateUserImportRows([
      row({ role, role_scope: roleScope }),
    ], references);

    expect(result.invalidCount).toBe(1);
    expect(result.rows[0].planned_action).toBe('rejected');
    expect(result.rows[0].validation_errors?.join(' ').toLowerCase()).toMatch(/role|division/);
    expect(result.rows[0].validation_errors?.join(' ').toLowerCase()).toContain('scope');
  });

  it('merges parser errors and counts numeric phone rejection as invalid', () => {
    const result = validateUserImportRows([
      row({ phone_original: '' }),
    ], references, { 2: ['phone: This value must be entered as text using the provided Excel template.'] });
    expect(result).toMatchObject({ invalidCount: 1, invalidPhoneCount: 1 });
    expect(result.rows[0].planned_action).toBe('rejected');
  });
});
