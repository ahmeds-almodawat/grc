import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/policySopApi.ts'),
  'utf8',
);

describe('P3 Policy and SOP canonical read contracts', () => {
  it('uses canonical department and profile names for document details', () => {
    expect(source).toContain('departments(id, name_en, name_ar, code)');
    expect(source).toContain('full_name_en, full_name_ar');
    expect(source).toContain('department_name: localizedName(doc.departments)');
    expect(source).toContain('document_owner_name: profileName(doc.profiles)');
    expect(source).not.toContain('departments(id, name, code)');
    expect(source).not.toContain('profiles!controlled_documents_document_owner_id_fkey(id, full_name)');
  });

  it('maps canonical master data back to the stable editor contracts', () => {
    expect(source).toContain(".from('departments')");
    expect(source).toContain(".select('id, name_en, name_ar, code')");
    expect(source).toContain('name: localizedName(department) || department.code');
    expect(source).toContain(".select('id, full_name_en, full_name_ar, email, job_title')");
    expect(source).toContain('full_name: profileName(profile) || profile.email');
  });

  it('uses the deployed control-library and accreditation column contracts', () => {
    expect(source).toContain(".from('control_library_items')");
    expect(source).toContain(".select('id, control_code, title')");
    expect(source).toContain('code: control.control_code');
    expect(source).toContain(".select('id, clause_code, clause_title')");
    expect(source).toContain('clause_number: clause.clause_code');
    expect(source).not.toContain(".from('controls')");
  });

  it('keeps SOP controls, owners, events, and risk departments canonical', () => {
    expect(source).toContain('control_library_items(control_code, title, control_type, key_control)');
    expect(source).toContain('required_control_code: ctrl?.control_code || null');
    expect(source).toContain('owner_name: profileName(prof)');
    expect(source).toContain('actor_name: profileName(ev.profiles)');
    expect(source).toContain('departments(name_en, name_ar)');
    expect(source).not.toContain('departments(name)');
  });
});
