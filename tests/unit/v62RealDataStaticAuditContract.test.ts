import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const auditScript = resolve('scripts/v62-real-data-static-audit.mjs');
const temporaryProjects: string[] = [];

function runAudit(source: string) {
  const project = mkdtempSync(resolve(tmpdir(), 'grc-v62-audit-'));
  temporaryProjects.push(project);
  mkdirSync(resolve(project, 'src/pages'), { recursive: true });
  writeFileSync(resolve(project, 'src/pages/Fixture.tsx'), source);

  const result = spawnSync(process.execPath, [auditScript, '--strict'], {
    cwd: project,
    encoding: 'utf8',
  });
  const report = JSON.parse(
    readFileSync(resolve(project, 'release/v62/v62-real-data-static-audit.json'), 'utf8'),
  );

  return { result, report };
}

afterEach(() => {
  for (const project of temporaryProjects.splice(0)) {
    rmSync(project, { recursive: true, force: true });
  }
});

describe('v62 real-data static audit contract', () => {
  it('accepts UI field descriptors and computed chart aggregates', () => {
    const { result, report } = runAudit(`
      export function fields() {
        return [{ id: 'note', label: 'Decision rationale', type: 'textarea', required: true }];
      }
      export function aggregate(name: string, rows: Array<{ status: string }>) {
        return { name, total: rows.length, completed: rows.filter((row) => row.status === 'completed').length };
      }
    `);

    expect(result.status).toBe(0);
    expect(report.production_blocking_findings).toBe(0);
  });

  it('still rejects literal runtime business records', () => {
    const { result, report } = runAudit(`
      export function risks() {
        return [{ id: 'risk-1', title: 'Hardcoded risk' }];
      }
    `);

    expect(result.status).toBe(2);
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'DIRECT_LITERAL_RECORD_RETURN' }),
    ]));
  });
});
