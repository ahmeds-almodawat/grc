import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/components/policy-sop/SopProcedureBuilder.tsx'),
  'utf8',
);

describe('P3 SOP step RACI editor contract', () => {
  it('creates required Responsible and Accountable assignments for new steps', () => {
    expect(source).toContain("{ raci_type: 'R', role_name: 'Clinical Nurse / Officer'");
    expect(source).toContain("{ raci_type: 'A', role_name: 'Head of Section'");
  });

  it('exposes R, A, C, and I role controls without allowing duplicate type entries', () => {
    expect(source).toContain("assignment.raci_type !== raciType");
    expect(source).toContain("['R', t('sop.step.raciResponsible'");
    expect(source).toContain("['A', t('sop.step.raciAccountable'");
    expect(source).toContain("['C', t('sop.step.raciConsulted'");
    expect(source).toContain("['I', t('sop.step.raciInformed'");
  });
});
