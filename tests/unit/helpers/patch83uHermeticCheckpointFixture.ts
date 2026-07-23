import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const STAGING_PROJECT_REF = 'zghsgzrdwbqdrpuxanac';

export function createSyntheticPatch83uCheckpointFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'patch83u-checkpoint-fixture-'));
  const path = join(directory, '01-before-employee-sessions.json');
  const payload = {
    schema_version: 'patch83u-staging-sql-editor-checkpoint-file-v3',
    checkpoint: 'before_employee_sessions',
    captured_at: new Date().toISOString(),
    expected_project_ref: STAGING_PROJECT_REF,
    transaction_read_only: true,
    runtime: {
      enforcement_state: 'enforced',
      state_version: 5,
    },
    employee: {
      user_id: '00000000-0000-4000-8000-000000000111',
      credential_state: 'active',
      database_credential_version: 4,
      auth_credential_version: 4,
      role: 'employee',
      scope: 'assigned_only',
      pending_operation: false,
    },
    super_admin: {
      user_id: '00000000-0000-4000-8000-000000000999',
      credential_state: 'active',
      credential_version: 1,
      role: 'super_admin',
      scope: 'global',
      pending_operation: false,
    },
    synthetic_fixture: true,
  };
  writeFileSync(path, `${JSON.stringify(payload)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  return Object.freeze({
    path,
    dispose: () => rmSync(directory, { recursive: true, force: true }),
  });
}
