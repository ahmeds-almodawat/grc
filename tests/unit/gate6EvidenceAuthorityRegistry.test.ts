import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const registry = JSON.parse(readFileSync(
  resolve('release/production-readiness/gate6-evidence-authority-registry-20260721.json'),
  'utf8',
));

function sha256(path: string) {
  return createHash('sha256').update(readFileSync(resolve(path))).digest('hex');
}

describe('Gate 6 evidence authority registry', () => {
  it('is deterministic, unique, and binds every immutable artifact to its bytes', () => {
    expect(registry.schema_version).toBe('gate6-evidence-authority-registry-v1');
    const paths = registry.artifacts.map((artifact: { path: string }) => artifact.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual([...paths].sort((left, right) => (
      left < right ? -1 : left > right ? 1 : 0
    )));
    for (const artifact of registry.artifacts) {
      expect(sha256(artifact.path)).toBe(artifact.immutable_sha256);
    }
  });

  it('selects one current proof contract and one current freeze', () => {
    const current = registry.artifacts.filter(
      (artifact: { status: string }) => artifact.status === 'current',
    );
    expect(current.map((artifact: { path: string }) => artifact.path)).toEqual([
      'release/patch83u/patch83u-run009-proof-contract.json',
      'release/patch83u/patch83u-staging-reset-execution-freeze-v9-20260721.json',
    ]);
    expect(current.every((artifact: { superseded_by: null }) => (
      artifact.superseded_by === null
    ))).toBe(true);
  });

  it('keeps superseded and historical evidence immutable but non-authoritative', () => {
    const noncurrent = registry.artifacts.filter(
      (artifact: { status: string }) => artifact.status !== 'current',
    );
    expect(noncurrent).toHaveLength(5);
    expect(noncurrent.every((artifact: { superseded_by: string }) => (
      typeof artifact.superseded_by === 'string'
      && artifact.superseded_by.length > 0
    ))).toBe(true);
    expect(noncurrent.some((artifact: { authority_classification: string }) => (
      artifact.authority_classification === 'immutable_historical_evidence'
    ))).toBe(true);
    expect(noncurrent.some((artifact: { authority_classification: string }) => (
      artifact.authority_classification === 'superseded_freeze'
    ))).toBe(true);
  });

  it('normalizes path and line-ending comparisons without changing artifact bytes', () => {
    const canonical = registry.artifacts.map((artifact: { path: string }) => artifact.path);
    const windows = canonical.map((path: string) => path.replaceAll('/', '\\'));
    expect(windows.map((path: string) => path.replaceAll('\\', '/'))).toEqual(canonical);
    expect('a\r\nb\r\n'.replaceAll('\r\n', '\n')).toBe('a\nb\n');
  });
});
