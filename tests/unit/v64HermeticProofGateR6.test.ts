import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  analyzeMigrationFiles,
  compareRlsReports,
  loadMigrationFilesFromGitRef,
} from '../../scripts/lib/v64-rls-analyzer.mjs';
import {
  comprehensiveGroupOrder,
  proofCommandContracts,
  proofGroups,
  selectedProofCommands,
} from '../../scripts/v700-proof-suite.mjs';

type Migration = { path: string; text: string };

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function migration(name: string, text: string): Migration {
  return { path: `supabase/migrations/${name}`, text };
}

function controlledDenyAllSql(options: {
  force?: boolean;
  roles?: string[];
  policy?: boolean;
} = {}) {
  const roles = options.roles ?? ['public', 'anon', 'authenticated', 'service_role'];
  return `
    create table public.ovr_secure_fixture(id uuid primary key);
    alter table public.ovr_secure_fixture enable row level security;
    ${options.force === false ? '' : 'alter table public.ovr_secure_fixture force row level security;'}
    ${options.policy ? 'create policy ovr_secure_fixture_read on public.ovr_secure_fixture for select to authenticated using (true);' : ''}
    revoke all on table public.ovr_secure_fixture from ${roles.join(', ')};
    grant select on table public.ovr_secure_fixture to service_role;
  `;
}

function highFindings(report: ReturnType<typeof analyzeMigrationFiles>) {
  return report.findings.filter((finding) => ['critical', 'high'].includes(finding.severity));
}

describe('R6 structural controlled deny-all analyzer', () => {
  it('classifies an ordered complete ACL lockdown as CONTROLLED_DENY_ALL', () => {
    const report = analyzeMigrationFiles([migration('001_safe.sql', controlledDenyAllSql())]);
    expect(highFindings(report)).toEqual([]);
    expect(report.observations).toMatchObject([{
      code: 'CONTROLLED_DENY_ALL',
      table: 'ovr_secure_fixture',
      rls_enabled: true,
      rls_forced: true,
      complete_acl_lockdown_after_rls: true,
    }]);
  });

  it('fails High when FORCE RLS is missing', () => {
    const report = analyzeMigrationFiles([
      migration('001_missing_force.sql', controlledDenyAllSql({ force: false })),
    ]);
    expect(highFindings(report)).toMatchObject([{
      severity: 'high',
      code: 'RLS_NO_POLICY_FOUND',
      missing_controlled_deny_all_proofs: expect.arrayContaining(['force_rls']),
    }]);
  });

  it.each([
    ['authenticated', ['public', 'anon', 'service_role']],
    ['anon', ['public', 'authenticated', 'service_role']],
    ['public', ['anon', 'authenticated', 'service_role']],
  ])('fails High when the %s revoke is missing', (role, roles) => {
    const report = analyzeMigrationFiles([
      migration(`001_missing_${role}.sql`, controlledDenyAllSql({ roles })),
    ]);
    expect(highFindings(report)).toMatchObject([{
      severity: 'high',
      missing_controlled_deny_all_proofs: expect.arrayContaining([`explicit_${role}_revoke`]),
    }]);
  });

  it('fails when a later migration grants raw browser access', () => {
    const report = analyzeMigrationFiles([
      migration('001_safe.sql', controlledDenyAllSql()),
      migration('002_regression.sql', 'grant select on table public.ovr_secure_fixture to authenticated;'),
    ]);
    expect(highFindings(report)).toMatchObject([{
      severity: 'high',
      code: 'RLS_BROWSER_GRANT_WITHOUT_POLICY',
      browser_grants: [{ role: 'authenticated', privilege: 'select' }],
    }]);
    expect(report.observations).toEqual([]);
  });

  it('fails closed when an ACL statement for the table is ambiguous', () => {
    const report = analyzeMigrationFiles([
      migration('001_safe.sql', controlledDenyAllSql()),
      migration('002_ambiguous.sql', 'revoke frobnicate on table public.ovr_secure_fixture from authenticated;'),
    ]);
    expect(highFindings(report)).toMatchObject([{
      severity: 'high',
      code: 'RLS_NO_POLICY_FOUND',
      missing_controlled_deny_all_proofs: expect.arrayContaining(['unambiguous_acl_history']),
    }]);
    expect(report.observations).toEqual([]);
  });

  it('retains normal policy-controlled RLS behavior', () => {
    const report = analyzeMigrationFiles([
      migration('001_policy.sql', controlledDenyAllSql({ policy: true })),
    ]);
    expect(highFindings(report)).toEqual([]);
    expect(report.observations).toEqual([]);
  });
});

describe('R6 base/head regression classification', () => {
  const inheritedUnsafe = migration('001_historical.sql', `
    create table public.user_historical_fixture(id uuid primary key);
    alter table public.user_historical_fixture enable row level security;
  `);

  it('fails for a new unsafe table while retaining an inherited High', () => {
    const base = analyzeMigrationFiles([inheritedUnsafe]);
    const head = analyzeMigrationFiles([
      inheritedUnsafe,
      migration('002_new_unsafe.sql', `
        create table public.ovr_new_unsafe(id uuid primary key);
        alter table public.ovr_new_unsafe enable row level security;
      `),
    ]);
    const regression = compareRlsReports(base, head);
    expect(regression.status).toBe('failed_new_rls_blockers');
    expect(regression.summary).toMatchObject({
      inherited_unresolved_high: 1,
      new_high: 1,
      strict_regression_passed: false,
    });
  });

  it('reports an unchanged historical High as inherited unresolved without failing', () => {
    const base = analyzeMigrationFiles([inheritedUnsafe]);
    const regression = compareRlsReports(base, analyzeMigrationFiles([inheritedUnsafe]));
    expect(regression.status).toBe('passed');
    expect(regression.summary).toMatchObject({ inherited_unresolved_high: 1, new_high: 0 });
    expect(regression.inherited_unresolved[0].table).toBe('user_historical_fixture');
  });

  it('reports a fixed inherited High as resolved', () => {
    const base = analyzeMigrationFiles([inheritedUnsafe]);
    const fixed = migration('001_historical.sql', `
      create table public.user_historical_fixture(id uuid primary key);
      alter table public.user_historical_fixture enable row level security;
      alter table public.user_historical_fixture force row level security;
      revoke all on table public.user_historical_fixture from public, anon, authenticated, service_role;
    `);
    const regression = compareRlsReports(base, analyzeMigrationFiles([fixed]));
    expect(regression.status).toBe('passed');
    expect(regression.summary).toMatchObject({ resolved_high: 1, new_high: 0 });
  });

  it('fails closed when an explicit base SHA cannot be resolved', () => {
    const repository = fs.mkdtempSync(path.join(os.tmpdir(), 'grc-r6-missing-base-'));
    temporaryDirectories.push(repository);
    expect(spawnSync('git', ['init'], { cwd: repository }).status).toBe(0);
    expect(() => loadMigrationFilesFromGitRef(repository, 'definitely-not-a-commit')).toThrow();
  });
});

describe('R6 proof-suite and GitHub workflow contract', () => {
  const root = path.resolve(import.meta.dirname, '..', '..');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');

  it('keeps proof:ci hermetic and documents every included command', () => {
    expect(proofGroups.ci).toEqual([
      'v62:static-strict',
      'v64:rls-regression',
      'v64:functions-strict',
      'v64:views-strict',
      'v64:persona-sql',
      'v700:rpc-inventory',
      'v700:v65-audit-strict',
      'v700:vercel-deployment-policy',
    ]);
    for (const command of proofGroups.ci) {
      expect(proofCommandContracts[command]).toMatchObject({ hermetic: true });
      expect(proofCommandContracts[command].proves.length).toBeGreaterThan(10);
    }
  });

  it('preserves comprehensive proof:all and explicit controlled entry points', () => {
    expect(comprehensiveGroupOrder).toEqual([
      'technical',
      'runtime-security',
      'personas',
      'restore',
      'pilot',
    ]);
    expect(selectedProofCommands('all')).toEqual(expect.arrayContaining([
      'v673:security-definer-audit',
      'v72:persona-proof',
      'v674:restore-dryrun',
      'v672:capture',
      'v674:signoff-check',
    ]));
    expect(proofGroups['runtime-local']).toEqual([
      'v673:security-definer-audit',
      'v72:persona-proof',
      'v672:capture',
    ]);
    expect(proofGroups.governance).toEqual([
      'v674:signoff-check',
      'v662:strict-proof',
      'v661:strict-proof',
      'v66:strict-proof',
      'v663:progress-audit',
    ]);
    expect(packageJson.scripts['proof:all']).toBe('node scripts/v700-proof-suite.mjs all');
  });

  it('uses proof:ci with a full-history checkout and exact event base SHA', () => {
    expect(workflow).toContain('fetch-depth: 0');
    expect(workflow).toContain('github.event.pull_request.base.sha');
    expect(workflow).toContain('github.event.before');
    expect(workflow).toContain('GRC_RLS_BASE_REF:');
    expect(workflow).toContain('run: npm run proof:ci');
    expect(workflow).not.toContain('run: npm run proof:all');
    expect(packageJson.scripts['proof:ci']).toBe('node scripts/v700-proof-suite.mjs ci');
    expect(packageJson.scripts['proof:runtime-local']).toBe('node scripts/v700-proof-suite.mjs runtime-local');
    expect(packageJson.scripts['proof:governance']).toBe('node scripts/v700-proof-suite.mjs governance');
  });
});
