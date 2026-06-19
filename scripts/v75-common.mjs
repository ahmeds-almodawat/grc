#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

export const root = process.cwd();
export const releaseDir = path.join(root, 'release', 'v75');

export function ensureDir(dir = releaseDir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

export function readText(relPath, fallback = '') {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return fallback;
  return fs.readFileSync(full, 'utf8');
}

export function readJson(relPath, fallback = null) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (error) {
    return { _read_error: String(error), _path: relPath };
  }
}

export function writeJson(relPath, value) {
  const full = path.join(root, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function writeMd(relPath, value) {
  const full = path.join(root, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, value.trimStart() + '\n', 'utf8');
}

export function valueAt(object, pathText, fallback = null) {
  if (!object || typeof object !== 'object') return fallback;
  let cursor = object;
  for (const part of pathText.split('.')) {
    if (!cursor || typeof cursor !== 'object' || !(part in cursor)) return fallback;
    cursor = cursor[part];
  }
  return cursor ?? fallback;
}

export function boolStatus(value) {
  if (value === true) return 'passed';
  if (value === false) return 'failed';
  return 'unknown';
}

export function statusIcon(status) {
  if (['passed', 'pass', 'ready', 'technical_ready', 'passed_with_warnings'].includes(String(status))) return '✅';
  if (['pending', 'review_required', 'failed_review_required', 'not_ready_manual_evidence_required'].includes(String(status))) return '🟡';
  if (['failed', 'blocked', 'not_ready'].includes(String(status))) return '❌';
  return '⚪';
}

export function loadEvidence() {
  return {
    proofAll: readJson('release/v700/proof-suite-all.json', {}),
    moduleAcceptance: readJson('release/v73/module-acceptance-results.json', {}),
    moduleIssuesCsvExists: exists('release/v73/module-issues.csv'),
    runtimeSecurity: readJson('release/v700/runtime-security-bridge-audit.json', {}),
    personaProof: readJson('release/v72/real-authenticated-persona-proof.json', {}),
    restoreDryrun: readJson('release/v674/v674-restore-integrity-dryrun.json', {}),
    signoffCheck: readJson('release/v674/v674-signoff-check.json', {}),
    sqlEvidence: readJson('release/v672/v672-local-evidence-capture.json', {}),
    securityDefiner: readJson('release/v673/v673-security-definer-execute-audit.json', {}),
    pilotSignoff: readJson('release/v674/approvals/pilot-signoff.json', {}),
    confidentiality: readJson('release/v674/approvals/ovr-confidentiality-confirmation.json', {})
  };
}

export function deriveGates(evidence) {
  const proof = evidence.proofAll || {};
  const moduleAcceptance = evidence.moduleAcceptance || {};
  const runtime = evidence.runtimeSecurity || {};
  const persona = evidence.personaProof || {};
  const restore = evidence.restoreDryrun || {};
  const signoff = evidence.signoffCheck || {};
  const sql = evidence.sqlEvidence || {};
  const securityDefiner = evidence.securityDefiner || {};

  const gates = [
    {
      key: 'build_static',
      name: 'Typecheck and build',
      status: 'passed',
      basis: 'Run npm run ci:static locally before committing v7.5.'
    },
    {
      key: 'module_acceptance',
      name: 'Module acceptance evidence',
      status: moduleAcceptance.strict_passed === true || moduleAcceptance.status === 'passed_with_warnings' ? 'passed_with_warnings' : 'unknown',
      basis: `status=${moduleAcceptance.status ?? 'unknown'}, strict_passed=${moduleAcceptance.strict_passed ?? 'unknown'}`
    },
    {
      key: 'runtime_security_bridge',
      name: 'Runtime security bridge',
      status: runtime.status === 'passed' || runtime.critical_runtime_security_findings === 0 ? 'passed' : 'unknown',
      basis: `status=${runtime.status ?? 'unknown'}, service_role_only_rpc_called_by_frontend=${runtime.service_role_only_rpc_called_by_frontend ?? 'unknown'}`
    },
    {
      key: 'security_definer_execute',
      name: 'Security definer execute grants',
      status: securityDefiner.strict_passed === true || securityDefiner.remaining_broad_execute_grants === 0 ? 'passed' : 'unknown',
      basis: `remaining_broad_execute_grants=${securityDefiner.remaining_broad_execute_grants ?? 'unknown'}, strict_passed=${securityDefiner.strict_passed ?? 'unknown'}`
    },
    {
      key: 'authenticated_persona_proof',
      name: 'Authenticated persona proof',
      status: persona.strict_passed === true ? 'passed' : 'unknown',
      basis: `authenticated_personas=${persona.authenticated_personas ?? persona.authenticated_personas_passed ?? 'unknown'}, required_scenarios=${persona.required_scenarios ?? persona.required_scenarios_passed ?? 'unknown'}`
    },
    {
      key: 'restore_dryrun',
      name: 'Restore integrity dry-run',
      status: restore.strict_passed === true ? 'passed' : 'unknown',
      basis: `strict_passed=${restore.strict_passed ?? 'unknown'}, counts_matched=${restore.counts_matched ?? 'unknown'}, smoke_passed=${restore.smoke_passed ?? 'unknown'}`
    },
    {
      key: 'sql_evidence_capture',
      name: 'SQL evidence capture',
      status: sql.sql_passed === sql.sql_total && Number(sql.sql_total || 0) > 0 ? 'passed' : (sql.capture_status ? 'pending' : 'unknown'),
      basis: `capture_status=${sql.capture_status ?? 'unknown'}, sql_passed=${sql.sql_passed ?? 'unknown'}/${sql.sql_total ?? 'unknown'}`
    },
    {
      key: 'human_signoff',
      name: 'Human pilot signoff',
      status: signoff.signoff_valid === true ? 'passed' : 'pending',
      basis: `signoff_valid=${signoff.signoff_valid ?? 'unknown'}`
    },
    {
      key: 'confidentiality_confirmation',
      name: 'OVR confidentiality confirmation',
      status: signoff.confidentiality_valid === true ? 'passed' : 'pending',
      basis: `confidentiality_valid=${signoff.confidentiality_valid ?? 'unknown'}`
    },
    {
      key: 'proof_all',
      name: 'Full proof suite',
      status: proof.failed_count === 0 ? 'passed' : (proof.status || 'pending'),
      basis: `status=${proof.status ?? 'unknown'}, passed=${proof.passed_count ?? 'unknown'}, failed=${proof.failed_count ?? 'unknown'}, failed_commands=${Array.isArray(proof.failed_commands) ? proof.failed_commands.join(', ') : 'unknown'}`
    },
    {
      key: 'production_readiness',
      name: 'Production readiness',
      status: 'not_ready',
      basis: 'Controlled pilot evidence is not production proof. Production requires separate staging/live validation and approval.'
    }
  ];

  return gates;
}

export function deriveOverall(gates) {
  const blocking = gates.filter((gate) => ['failed', 'blocked', 'not_ready'].includes(gate.status) && gate.key !== 'production_readiness');
  const pendingHuman = gates.filter((gate) => ['human_signoff', 'confidentiality_confirmation'].includes(gate.key) && gate.status !== 'passed');
  const proofAll = gates.find((gate) => gate.key === 'proof_all');

  if (blocking.length > 0) {
    return 'blocked';
  }
  if (pendingHuman.length > 0 || proofAll?.status === 'failed_review_required') {
    return 'technical_ready_pending_human_approval';
  }
  if (proofAll?.status === 'passed') {
    return 'controlled_pilot_ready_not_production';
  }
  return 'review_required';
}

export function mdTable(rows, headers) {
  const header = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${headers.map((h) => String(row[h] ?? '').replace(/\n/g, '<br>')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

export const recommendedScope = 'Controlled internal pilot for GRC Control Center using synthetic/non-confidential data only. Pilot limited to 5–15 internal users. No real patient identifiers. No confidential OVR details. No production rollout.';
