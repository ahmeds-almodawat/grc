import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const bridge = fs.readFileSync(
  path.join(root, 'release/p3/p3-pre217-critical-attention-compatibility.sql'),
  'utf8',
);
const runner = fs.readFileSync(
  path.join(root, 'release/p3/invoke-p3-pre217-critical-attention-compatibility.ps1'),
  'utf8',
);

describe('P3 pre-217 compatibility bridge', () => {
  it('fails closed on the exact staging ledger and supported fingerprints', () => {
    expect(bridge).toContain("v_ceiling is distinct from '216'");
    expect(bridge).toContain('v_ledger_count <> 171');
    expect(bridge).toContain('v_forward_count <> 29');
    expect(bridge).toContain('df6a444271d323bb97cf12f062486e6f');
    expect(bridge).toContain('a332a995c7c7b46ea23325a2c807c9c6');
    expect(bridge).toContain('P3_PRE217_COLUMN_SHAPE_UNSUPPORTED');
    expect(bridge).toContain('P3_PRE217_DEPENDENCIES_UNSUPPORTED');
  });

  it('uses one atomic bounded command without migration-ledger manipulation', () => {
    expect(bridge).toMatch(/^-- P3-R1[\s\S]*\ndo \$bridge\$/);
    expect(bridge.trimEnd()).toMatch(/\$bridge\$;$/);
    expect(bridge).toContain("set_config('lock_timeout', '5s', true)");
    expect(bridge).toContain("set_config('statement_timeout', '120s', true)");
    expect(bridge).toContain('drop view public.v_critical_attention_items');
    expect(bridge).not.toMatch(/drop\s+view[^;]+cascade/i);
    expect(bridge).not.toMatch(/(?:insert|update|delete)\s+(?:into\s+|from\s+)?supabase_migrations/i);
    expect(bridge).not.toContain('migration repair');
  });

  it('establishes the canonical security-invoker and ACL contract', () => {
    expect(bridge).toContain('with (security_invoker = true)');
    expect(bridge).toContain(
      'revoke all privileges on public.v_critical_attention_items',
    );
    expect(bridge).toContain(
      'grant select on public.v_critical_attention_items to authenticated, service_role',
    );
    expect(bridge).not.toMatch(/grant\s+select[^;]+\bto\s+(?:public|anon)\b/i);
  });

  it('requires an explicit local-proof or exact staging target', () => {
    expect(runner).toContain("[ValidateSet('LocalProof', 'Staging')]");
    expect(runner).toContain("$expectedStagingRef = 'zghsgzrdwbqdrpuxanac'");
    expect(runner).toContain('P3_WRONG_STAGING_TARGET');
    expect(runner).toContain("$proofUri.Host -notin @('127.0.0.1', 'localhost')");
    expect(runner).toContain("-ne 'p3_r1_proof'");
    expect(runner).not.toContain('zbrjjecpsrzposhuarcn');
  });
});
