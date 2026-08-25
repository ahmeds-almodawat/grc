import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/216_ui7_my_work_training_read_contract.sql'),
  'utf8',
);
const trainingApi = readFileSync(resolve(process.cwd(), 'src/lib/trainingGovernanceApi.ts'), 'utf8');
const myWorkApi = readFileSync(resolve(process.cwd(), 'src/lib/ui7ApprovalsReportsApi.ts'), 'utf8');
const patch38 = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/099_patch38_unified_work_queue_hospital_master_data.sql'),
  'utf8',
);

describe('UI-7R3 My Work Training read contract', () => {
  it('grants authenticated SELECT only after proving the live queue remains safe', () => {
    expect(migration).toContain("coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']");
    expect(migration).toContain("c.relname in ('training_assignments', 'training_programs', 'profiles', 'departments')");
    expect(migration).toContain('c.relrowsecurity is not true');
    expect(migration).toMatch(/revoke all privileges[\s\S]*from public, anon, authenticated;/i);
    expect(migration).toMatch(/grant select on table public\.v_patch29_training_assignment_queue[\s\S]*to authenticated;/i);
    expect(migration).not.toMatch(/create\s+(or replace\s+)?view|alter\s+view|create\s+policy|alter\s+table/i);
  });

  it('keeps UI-5 and My Work on the same canonical Training queue', () => {
    expect(trainingApi).toContain(".from('v_patch29_training_assignment_queue')");
    expect(myWorkApi).toContain(".from('v_patch38_my_work_queue')");
    expect(patch38).toContain("select 'training','training_assignment'");
    expect(patch38).toContain('from public.v_patch29_training_assignment_queue tr');
    expect(patch38).toContain("where tr.status not in ('completed','waived','cancelled')");
  });

  it('preserves the governed Training drill-down and required queue fields', () => {
    expect(myWorkApi).toContain("if (sourceModule === 'training') return 'trainingGovernance'");
    for (const field of ['tr.id', 'tr.program_title', 'tr.training_type', 'tr.status', 'tr.assigned_to_user_id', 'tr.due_date', 'tr.assigned_at', 'tr.program_id']) {
      expect(patch38).toContain(field);
    }
  });
});
