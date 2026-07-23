import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function requiredArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0 || !process.argv[index + 1]) {
    throw new Error(`GATE12S_ARGUMENT_REQUIRED:${name}`);
  }
  return process.argv[index + 1];
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: options.binary ? 'buffer' : 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

function ordinal(values) {
  return [...values].sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
}

function same(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function parseIndex() {
  const entries = git(['ls-files', '--stage', '-z']).split('\0').filter(Boolean).map((record) => {
    const match = record.match(/^(\d+) ([0-9a-f]+) (\d)\t([\s\S]+)$/);
    if (!match) throw new Error('GATE12S_INDEX_RECORD_MALFORMED');
    return { mode: match[1], oid: match[2], stage: Number(match[3]), path: match[4] };
  });
  const byPath = new Map();
  for (const entry of entries) {
    const existing = byPath.get(entry.path) ?? [];
    existing.push(entry);
    byPath.set(entry.path, existing);
  }
  return byPath;
}

function assertSafePath(path) {
  const normalized = path.replaceAll('\\', '/');
  const forbidden = [
    /(^|\/)\.env(?:$|\.(?!example$))/i,
    /\.dpapi$/i,
    /(^|\/)(?:node_modules|\.vercel|test-results|playwright-report|coverage)(\/|$)/i,
    /(^|\/)(?:cookies?|sessions?|storage-state)(?:\.|\/|$)/i,
  ];
  if (forbidden.some((pattern) => pattern.test(normalized))) {
    throw new Error(`GATE12S_FORBIDDEN_RELEASE_PATH:${normalized}`);
  }
}

export function buildStagedManifest({ approvedManifestPath, outputPath }) {
  const approved = JSON.parse(readFileSync(resolve(approvedManifestPath), 'utf8'));
  if (!Array.isArray(approved.approved_paths) || !Array.isArray(approved.control_paths)) {
    throw new Error('GATE12S_APPROVED_MANIFEST_SCHEMA_INVALID');
  }
  const approvedPaths = ordinal(new Set(approved.approved_paths.map(String)));
  const controlPaths = ordinal(new Set(approved.control_paths.map(String)));
  if (approvedPaths.length !== approved.approved_paths.length) {
    throw new Error('GATE12S_APPROVED_PATH_DUPLICATE');
  }
  if (controlPaths.some((path) => !approvedPaths.includes(path))) {
    throw new Error('GATE12S_CONTROL_PATH_NOT_APPROVED');
  }
  approvedPaths.forEach(assertSafePath);

  const stagedPaths = ordinal(git(['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean));
  if (!same(approvedPaths, stagedPaths)) {
    const missing = approvedPaths.filter((path) => !stagedPaths.includes(path));
    const unexpected = stagedPaths.filter((path) => !approvedPaths.includes(path));
    throw new Error(`GATE12S_STAGED_PATH_SET_MISMATCH:missing=${missing.join(',')}:unexpected=${unexpected.join(',')}`);
  }
  const deleted = git(['diff', '--cached', '--diff-filter=D', '--name-only', '-z']).split('\0').filter(Boolean);
  if (deleted.length) throw new Error(`GATE12S_UNEXPECTED_DELETION:${deleted.join(',')}`);

  const index = parseIndex();
  const payloadRecords = [];
  const observedControlPaths = [];
  for (const path of approvedPaths) {
    const entries = index.get(path) ?? [];
    if (entries.length !== 1 || entries[0].stage !== 0) {
      throw new Error(`GATE12S_INDEX_STAGE_INVALID:${path}`);
    }
    const entry = entries[0];
    const blob = git(['cat-file', 'blob', entry.oid], { binary: true });
    const record = {
      path,
      mode: entry.mode,
      object_id: entry.oid,
      bytes: blob.length,
      sha256: sha256(blob),
    };
    if (controlPaths.includes(path)) observedControlPaths.push(path);
    else payloadRecords.push(record);
  }

  const canonicalPayload = `${JSON.stringify({
    format: 'gate12s-git-index-payload-v1',
    files: payloadRecords,
  })}\n`;
  const result = {
    schema_version: 'gate12s-staged-payload-manifest-v1',
    hash_source: 'Git index stage-0 blobs read with git cat-file',
    ordering: 'ordinal UTF-8 repository-relative path',
    approved_staged_path_count: approvedPaths.length,
    payload_path_count: payloadRecords.length,
    control_path_count: observedControlPaths.length,
    payload_bytes: payloadRecords.reduce((total, record) => total + record.bytes, 0),
    payload_aggregate_sha256: sha256(Buffer.from(canonicalPayload, 'utf8')),
    payload_files: payloadRecords,
    control_paths: observedControlPaths,
  };
  writeFileSync(resolve(outputPath), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = buildStagedManifest({
    approvedManifestPath: requiredArg('approved-manifest'),
    outputPath: requiredArg('output'),
  });
  process.stdout.write(`${JSON.stringify({
    staged_paths: result.approved_staged_path_count,
    payload_paths: result.payload_path_count,
    payload_bytes: result.payload_bytes,
    payload_aggregate_sha256: result.payload_aggregate_sha256,
  })}\n`);
}
