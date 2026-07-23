#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RUN009_PROOF_CONTRACT_PATH =
  'release/patch83u/patch83u-run009-proof-contract.json';
export const RUN009_TRACEABILITY_PATH =
  'release/patch83u/patch83u-run009-proof-traceability.json';
export const RUN009_TRACEABILITY_MARKDOWN_PATH =
  'release/patch83u/patch83u-run009-proof-traceability.md';
export const RUN009_CHECKPOINT_SCHEMA_PATH =
  'release/patch83u/patch83u-staging-checkpoint-file-schema-v3.json';
export const RUN009_EVIDENCE_SCHEMA_PATH =
  'release/patch83u/patch83u-staging-reset-harness-schema-v8.json';
export const RUN009_HARNESS_PATH =
  'scripts/patch83u-staging-multisession-reset-proof.mjs';
export const RUN009_SQL_CHECKPOINT_PATH =
  'scripts/patch83u-staging-sql-editor-evidence.sql';
export const RUN009_PROOF_CONTRACT_VERSION = 'patch83u-run009-proof-contract-v1';
export const RUN009_PROOF_CONTRACT_ID = 'patch83u-hosted-reset-proof-run-009';
export const RUN009_TRACEABILITY_VERSION = 'patch83u-run009-proof-traceability-v1';
export const RUN009_CONFIRMATION_CONTRACT_ID =
  'patch83u-run009-reset-confirmation-v1';
export const RUN009_CONFIRMATION_PHRASE = 'EXECUTE RUN 009 RESET NOW';
export const RUN009_EXPECTED_SESSION_COUNT = 1;
export const RUN009_EXPECTED_UNREVOKED_REFRESH_TOKEN_COUNT = 1;
export const RUN009_INITIAL_CREDENTIAL_VERSION = 4;
export const RUN009_POST_RESET_CREDENTIAL_VERSION = 5;
export const RUN009_FINAL_CREDENTIAL_VERSION = 6;

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_FAILURE_CODE_PATTERN = /^PATCH83U_[A-Z0-9_]{1,120}$/;
const CHECKPOINT_NAMES = Object.freeze([
  'before_employee_sessions',
  'immediately_before_reset',
  'immediately_after_reset',
  'before_required_password_change',
  'immediately_after_password_change_finalization',
  'after_fresh_employee_login',
]);
const CHECKPOINT_PHASES = Object.freeze({
  before_employee_sessions: 2,
  immediately_before_reset: 4,
  immediately_after_reset: 6,
  before_required_password_change: 10,
  immediately_after_password_change_finalization: 12,
  after_fresh_employee_login: 14,
});

export const RUN009_REQUIRED_REQUIREMENT_IDS = Object.freeze([
  'R009_P01_STAGING_AND_PRODUCTION_BOUNDARY',
  'R009_P01_FRONTEND_ORIGIN_EXACT',
  'R009_P01_FREEZE_AND_EDGE_PROVENANCE_EXACT',
  'R009_P01_RUNTIME_AND_CONTRACTS_EXACT',
  'R009_P01_PROOF_ARTIFACT_HASHES_EXACT',
  'R009_P01_TRACEABILITY_COMPLETE',
  'R009_P01_CONFIRMATION_AND_COUNT_CONTRACTS_FROZEN',
  'R009_P01_EVIDENCE_EXCLUSIONS_ACTIVE',
  'R009_P02_CHECKPOINT1_READ_ONLY',
  'R009_P02_INITIAL_EMPLOYEE_STATE',
  'R009_P02_INITIAL_ADMIN_STATE',
  'R009_P02_FINALIZER_AND_RECOVERY_READY',
  'R009_P03_ADMIN_CONTEXTS_READY',
  'R009_P03_TWO_EMPLOYEE_SESSIONS',
  'R009_P03_BOTH_REFRESHES_SUCCEED',
  'R009_P03_EMPLOYEE_AUTHORIZATION_PROVEN',
  'R009_P04_CHECKPOINT2_READ_ONLY',
  'R009_P04_TARGET_PRE_RESET_UNCHANGED',
  'R009_P04_ADMIN_AND_RUNTIME_UNCHANGED',
  'R009_P05_EXACT_RESET_CONFIRMATIONS',
  'R009_P05_ONE_SHOT_RESET',
  'R009_P05_STABLE_REQUEST_CORRELATION',
  'R009_P05_AMBIGUOUS_RESET_NO_RETRY',
  'R009_P06_CHECKPOINT3_ALWAYS',
  'R009_P06_RESET_OUTCOME_CLASSIFIED',
  'R009_P06_PROTECTED_STATE_FAIL_CLOSED',
  'R009_P07_RESET_SUCCESS_STATE_V5',
  'R009_P07_RESET_ZERO_SESSIONS',
  'R009_P07_RESET_GOVERNANCE_AND_AUDIT',
  'R009_P08_OLD_PASSWORD_REJECTED',
  'R009_P08_BOTH_REFRESH_REPLAYS_REJECTED',
  'R009_P08_BOTH_STALE_CONTEXTS_DENIED',
  'R009_P09_TEMPORARY_LOGIN_SUCCEEDS',
  'R009_P09_FORCED_CHANGE_ONLY',
  'R009_P10_CHECKPOINT4_READ_ONLY',
  'R009_P10_PRE_CHANGE_STATE_V5_WITH_TEMP_SESSION',
  'R009_P11_REQUIRED_CHANGE_ACTION_EXACT',
  'R009_P11_SECRET_AND_POLICY_CONTROLS',
  'R009_P11_GLOBAL_SIGNOUT_AND_FINALIZER',
  'R009_P11_NO_AUTO_RECOVERY_ACTION',
  'R009_P12_CHECKPOINT5_READ_ONLY',
  'R009_P12_FINAL_ACTIVE_V6_ZERO',
  'R009_P12_PASSWORD_CHANGED_AT_SET',
  'R009_P12_SESSIONS_REVOKED_AT_SET',
  'R009_P12_GOVERNANCE_AND_RECONCILIATION_CLEARED',
  'R009_P12_PASSWORD_CHANGE_AUDIT_CORRELATED',
  'R009_P12_BROWSER_SIGNED_OUT',
  'R009_P13_FRESH_PERMANENT_LOGIN',
  'R009_P13_EMPLOYEE_ROLE_SCOPE_PRESERVED',
  'R009_P13_DIRECT_ADMIN_DENIED',
  'R009_P13_NETWORK_CONSOLE_SAFE',
  'R009_P14_CHECKPOINT6_READ_ONLY',
  'R009_P14_EXACT_FINAL_SESSION_COUNT',
  'R009_P14_EXACT_FINAL_REFRESH_COUNT',
  'R009_P14_ADMIN_AND_RUNTIME_UNCHANGED',
  'R009_P14_REDACTED_EVIDENCE_VALID',
]);

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function objectValue(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  return value;
}

function exactKeys(value, required, code) {
  const candidate = objectValue(value, code);
  const actual = Object.keys(candidate).sort();
  const expected = [...required].sort();
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) {
    fail(code);
  }
  return candidate;
}

function nonEmptyString(value, code) {
  if (typeof value !== 'string' || value.trim() === '') fail(code);
  return value;
}

function exactStringArray(value, expected, code) {
  if (
    !Array.isArray(value)
    || value.length !== expected.length
    || value.some((entry, index) => entry !== expected[index])
  ) {
    fail(code);
  }
}

function requirementIndex(contract) {
  const requirements = [];
  for (const phase of contract.phases) {
    for (const requirement of phase.requirements) {
      requirements.push({
        ...requirement,
        phase: phase.phase,
      });
    }
  }
  return requirements;
}

function assertExpectedTargetValue(target, field, expected, code) {
  if (!Object.hasOwn(target, field) || target[field] !== expected) fail(code);
}

export function validateRun009ProofContract(contract) {
  exactKeys(contract, [
    'schema_version',
    'contract_id',
    'run_number',
    'decision_is_execution_authorization',
    'targets',
    'runtime_contract',
    'edge_contract',
    'confirmation_contract',
    'sql_editor_project_confirmation_contract',
    'final_session_contract',
    'checkpoint_contracts',
    'evidence_contract',
    'phases',
  ], 'PATCH83U_RUN009_PROOF_CONTRACT_SHAPE_INVALID');
  if (
    contract.schema_version !== RUN009_PROOF_CONTRACT_VERSION
    || contract.contract_id !== RUN009_PROOF_CONTRACT_ID
    || contract.run_number !== 9
    || contract.decision_is_execution_authorization !== false
  ) {
    fail('PATCH83U_RUN009_PROOF_CONTRACT_IDENTITY_INVALID');
  }

  const targets = exactKeys(contract.targets, [
    'allowed_staging_project_ref',
    'prohibited_production_project_ref',
    'application_origin',
    'target_user_id',
    'target_employee_id',
    'designated_super_admin_id',
  ], 'PATCH83U_RUN009_PROOF_TARGETS_INVALID');
  if (
    targets.allowed_staging_project_ref !== 'zghsgzrdwbqdrpuxanac'
    || targets.prohibited_production_project_ref !== 'zbrjjecpsrzposhuarcn'
    || targets.application_origin !== 'http://localhost:5173'
    || targets.target_user_id !== '2a276bdb-cf51-4303-846e-6b7fecf38b0c'
    || targets.target_employee_id !== '11111'
    || targets.designated_super_admin_id !== '83d92a59-6909-44e7-80f3-aff60a6734fb'
  ) {
    fail('PATCH83U_RUN009_PROOF_TARGETS_INVALID');
  }

  const runtime = exactKeys(contract.runtime_contract, [
    'schema_version',
    'enforcement_state',
    'state_version',
    'edge_contract',
    'frontend_contract',
    'required_migrations',
    'stable_finalizer',
  ], 'PATCH83U_RUN009_RUNTIME_CONTRACT_INVALID');
  if (
    runtime.schema_version !== '174.2-auth-first'
    || runtime.enforcement_state !== 'enforced'
    || runtime.state_version !== 5
    || runtime.edge_contract !== 'patch83u-edge-auth-first-v1'
    || runtime.frontend_contract !== 'patch83u-frontend-auth-first-v1'
    || runtime.stable_finalizer
      !== 'patch83u_finalize_password_change_after_revocation'
  ) {
    fail('PATCH83U_RUN009_RUNTIME_CONTRACT_INVALID');
  }
  exactStringArray(
    runtime.required_migrations,
    ['174', '176', '177'],
    'PATCH83U_RUN009_RUNTIME_CONTRACT_INVALID',
  );

  const edge = exactKeys(contract.edge_contract, [
    'function_name',
    'version',
    'status',
    'verify_jwt',
    'source_sha256',
    'source_bytes',
  ], 'PATCH83U_RUN009_EDGE_CONTRACT_INVALID');
  if (
    edge.function_name !== 'privileged-action'
    || edge.version !== 5
    || edge.status !== 'ACTIVE'
    || edge.verify_jwt !== true
    || edge.source_sha256
      !== 'f4a53ddfd0167ca62661c3c9acc6b7b320a0e43f4b96efc821308e1db73caf87'
    || edge.source_bytes !== 157176
  ) {
    fail('PATCH83U_RUN009_EDGE_CONTRACT_INVALID');
  }

  const confirmation = exactKeys(contract.confirmation_contract, [
    'contract_id',
    'exact_phrase',
    'case_sensitive',
    'cli_override_supported',
    'required_immediately_before_reset',
    'evidence_retention',
  ], 'PATCH83U_RUN009_CONFIRMATION_CONTRACT_INVALID');
  if (
    confirmation.contract_id !== RUN009_CONFIRMATION_CONTRACT_ID
    || confirmation.exact_phrase !== RUN009_CONFIRMATION_PHRASE
    || confirmation.case_sensitive !== true
    || confirmation.cli_override_supported !== false
    || confirmation.required_immediately_before_reset !== true
    || confirmation.evidence_retention !== 'boolean_and_contract_id_only'
  ) {
    fail('PATCH83U_RUN009_CONFIRMATION_CONTRACT_INVALID');
  }

  const sqlEditorProjectConfirmation = exactKeys(
    contract.sql_editor_project_confirmation_contract,
    [
      'gate_id',
      'cli_option',
      'required_for_evidence_channel',
      'expected_project_ref',
      'must_match_supabase_url',
      'must_match_freeze_target',
      'environment_fallback_supported',
      'generic_default_supported',
      'hidden_prompt_used',
      'evidence_retention',
    ],
    'PATCH83U_RUN009_SQL_EDITOR_PROJECT_CONFIRMATION_CONTRACT_INVALID',
  );
  if (
    sqlEditorProjectConfirmation.gate_id
      !== 'patch83u-sql-editor-project-confirmation-v1'
    || sqlEditorProjectConfirmation.cli_option !== '--sql-editor-project-ref'
    || sqlEditorProjectConfirmation.required_for_evidence_channel !== 'sql-editor'
    || sqlEditorProjectConfirmation.expected_project_ref
      !== 'zghsgzrdwbqdrpuxanac'
    || sqlEditorProjectConfirmation.must_match_supabase_url !== true
    || sqlEditorProjectConfirmation.must_match_freeze_target !== true
    || sqlEditorProjectConfirmation.environment_fallback_supported !== false
    || sqlEditorProjectConfirmation.generic_default_supported !== false
    || sqlEditorProjectConfirmation.hidden_prompt_used !== false
    || sqlEditorProjectConfirmation.evidence_retention
      !== 'passed_project_ref_and_gate_id_only'
  ) {
    fail('PATCH83U_RUN009_SQL_EDITOR_PROJECT_CONFIRMATION_CONTRACT_INVALID');
  }

  const finalSession = exactKeys(contract.final_session_contract, [
    'checkpoint',
    'expected_session_count',
    'expected_unrevoked_refresh_token_count',
    'enforcement',
    'cli_override_supported',
    'justification_basis',
  ], 'PATCH83U_RUN009_FINAL_SESSION_CONTRACT_INVALID');
  if (
    finalSession.checkpoint !== 'after_fresh_employee_login'
    || finalSession.expected_session_count !== RUN009_EXPECTED_SESSION_COUNT
    || finalSession.expected_unrevoked_refresh_token_count
      !== RUN009_EXPECTED_UNREVOKED_REFRESH_TOKEN_COUNT
    || finalSession.enforcement !== 'exact_integer_equality'
    || finalSession.cli_override_supported !== false
  ) {
    fail('PATCH83U_RUN009_FINAL_SESSION_CONTRACT_INVALID');
  }
  nonEmptyString(
    finalSession.justification_basis,
    'PATCH83U_RUN009_FINAL_SESSION_JUSTIFICATION_MISSING',
  );

  const checkpointContracts = objectValue(
    contract.checkpoint_contracts,
    'PATCH83U_RUN009_CHECKPOINT_CONTRACTS_INVALID',
  );
  exactStringArray(
    Object.keys(checkpointContracts),
    CHECKPOINT_NAMES,
    'PATCH83U_RUN009_CHECKPOINT_CONTRACTS_INVALID',
  );
  for (const checkpoint of CHECKPOINT_NAMES) {
    const checkpointContract = objectValue(
      checkpointContracts[checkpoint],
      'PATCH83U_RUN009_CHECKPOINT_CONTRACT_INVALID',
    );
    if (
      checkpointContract.phase !== CHECKPOINT_PHASES[checkpoint]
      || checkpointContract.transaction_read_only !== true
      || !Array.isArray(checkpointContract.required_target_fields)
      || checkpointContract.required_target_fields.length === 0
      || new Set(checkpointContract.required_target_fields).size
        !== checkpointContract.required_target_fields.length
    ) {
      fail('PATCH83U_RUN009_CHECKPOINT_CONTRACT_INVALID', checkpoint);
    }
  }
  const expectedVersions = {
    before_employee_sessions: RUN009_INITIAL_CREDENTIAL_VERSION,
    immediately_before_reset: RUN009_INITIAL_CREDENTIAL_VERSION,
    immediately_after_reset: RUN009_POST_RESET_CREDENTIAL_VERSION,
    before_required_password_change: RUN009_POST_RESET_CREDENTIAL_VERSION,
    immediately_after_password_change_finalization:
      RUN009_FINAL_CREDENTIAL_VERSION,
    after_fresh_employee_login: RUN009_FINAL_CREDENTIAL_VERSION,
  };
  for (const [checkpoint, expectedVersion] of Object.entries(expectedVersions)) {
    const expected = checkpoint === 'immediately_after_reset'
      ? checkpointContracts[checkpoint].successful_expected
      : checkpointContracts[checkpoint].expected;
    assertExpectedTargetValue(
      expected,
      'credential_version',
      expectedVersion,
      'PATCH83U_RUN009_CREDENTIAL_BASELINE_INVALID',
    );
    assertExpectedTargetValue(
      expected,
      'auth_credential_version',
      expectedVersion,
      'PATCH83U_RUN009_CREDENTIAL_BASELINE_INVALID',
    );
  }
  const initial = checkpointContracts.before_employee_sessions.expected;
  assertExpectedTargetValue(
    initial,
    'session_count',
    0,
    'PATCH83U_RUN009_INITIAL_SESSION_COUNT_INVALID',
  );
  assertExpectedTargetValue(
    initial,
    'unrevoked_refresh_token_count',
    0,
    'PATCH83U_RUN009_INITIAL_REFRESH_COUNT_INVALID',
  );
  const finalization =
    checkpointContracts.immediately_after_password_change_finalization;
  for (const field of [
    'password_changed_at_set',
    'sessions_revoked_at_set',
    'reconciliation_auth_changed',
  ]) {
    if (!finalization.required_target_fields.includes(field)) {
      fail('PATCH83U_RUN009_CHECKPOINT5_FIELD_MISSING', field);
    }
  }
  assertExpectedTargetValue(
    finalization.expected,
    'password_changed_at_set',
    true,
    'PATCH83U_RUN009_PASSWORD_CHANGED_AT_CONTRACT_INVALID',
  );
  assertExpectedTargetValue(
    finalization.expected,
    'sessions_revoked_at_set',
    true,
    'PATCH83U_RUN009_SESSIONS_REVOKED_AT_CONTRACT_INVALID',
  );
  assertExpectedTargetValue(
    finalization.expected,
    'reconciliation_auth_changed',
    false,
    'PATCH83U_RUN009_RECONCILIATION_CONTRACT_INVALID',
  );
  for (const checkpoint of CHECKPOINT_NAMES.filter((name) => (
    name !== 'immediately_after_password_change_finalization'
  ))) {
    const current = checkpointContracts[checkpoint];
    if (
      current.required_target_fields.includes('password_changed_at_set')
      || current.required_target_fields.includes('sessions_revoked_at_set')
      || Object.hasOwn(current.expected ?? {}, 'password_changed_at_set')
      || Object.hasOwn(current.expected ?? {}, 'sessions_revoked_at_set')
    ) {
      fail('PATCH83U_RUN009_FINALIZATION_FIELD_PHASE_LEAK', checkpoint);
    }
  }
  const fresh = checkpointContracts.after_fresh_employee_login;
  const temporaryLogin =
    checkpointContracts.before_required_password_change;
  assertExpectedTargetValue(
    temporaryLogin.expected,
    'session_count',
    1,
    'PATCH83U_RUN009_TEMPORARY_SESSION_CONTRACT_INVALID',
  );
  assertExpectedTargetValue(
    temporaryLogin.expected,
    'unrevoked_refresh_token_count',
    1,
    'PATCH83U_RUN009_TEMPORARY_SESSION_CONTRACT_INVALID',
  );
  assertExpectedTargetValue(
    fresh.expected,
    'session_count',
    RUN009_EXPECTED_SESSION_COUNT,
    'PATCH83U_RUN009_FINAL_SESSION_CONTRACT_INVALID',
  );
  assertExpectedTargetValue(
    fresh.expected,
    'unrevoked_refresh_token_count',
    RUN009_EXPECTED_UNREVOKED_REFRESH_TOKEN_COUNT,
    'PATCH83U_RUN009_FINAL_SESSION_CONTRACT_INVALID',
  );

  const evidence = exactKeys(contract.evidence_contract, [
    'schema_version',
    'redacted_only',
    'prohibited_keys',
    'permitted_value_classes',
  ], 'PATCH83U_RUN009_EVIDENCE_CONTRACT_INVALID');
  if (
    evidence.schema_version !== 'patch83u-staging-reset-proof-v8'
    || evidence.redacted_only !== true
    || !Array.isArray(evidence.prohibited_keys)
    || !Array.isArray(evidence.permitted_value_classes)
  ) {
    fail('PATCH83U_RUN009_EVIDENCE_CONTRACT_INVALID');
  }
  for (const prohibited of [
    'password',
    'access_token',
    'refresh_token',
    'cookie',
    'authorization',
    'service_role',
    'session_id',
    'email',
    'raw_request_body',
    'raw_response_body',
    'storage_state',
  ]) {
    if (!evidence.prohibited_keys.includes(prohibited)) {
      fail('PATCH83U_RUN009_EVIDENCE_EXCLUSION_MISSING', prohibited);
    }
  }

  if (!Array.isArray(contract.phases) || contract.phases.length !== 14) {
    fail('PATCH83U_RUN009_PHASE_CONTRACT_INCOMPLETE');
  }
  for (let index = 0; index < contract.phases.length; index += 1) {
    const phase = exactKeys(contract.phases[index], [
      'phase',
      'name',
      'requirements',
    ], 'PATCH83U_RUN009_PHASE_CONTRACT_INVALID');
    if (
      phase.phase !== index + 1
      || !/^[a-z0-9_]+$/.test(phase.name)
      || !Array.isArray(phase.requirements)
      || phase.requirements.length === 0
    ) {
      fail('PATCH83U_RUN009_PHASE_CONTRACT_INVALID', String(index + 1));
    }
    for (const requirement of phase.requirements) {
      exactKeys(
        requirement,
        ['id', 'condition'],
        'PATCH83U_RUN009_REQUIREMENT_SHAPE_INVALID',
      );
      nonEmptyString(
        requirement.condition,
        'PATCH83U_RUN009_REQUIREMENT_CONDITION_MISSING',
      );
      if (!new RegExp(`^R009_P${String(phase.phase).padStart(2, '0')}_[A-Z0-9_]+$`)
        .test(requirement.id)) {
        fail('PATCH83U_RUN009_REQUIREMENT_ID_INVALID', requirement.id);
      }
    }
  }
  const requirements = requirementIndex(contract);
  const ids = requirements.map((requirement) => requirement.id);
  if (
    ids.length !== RUN009_REQUIRED_REQUIREMENT_IDS.length
    || new Set(ids).size !== ids.length
    || RUN009_REQUIRED_REQUIREMENT_IDS.some((id) => !ids.includes(id))
  ) {
    fail('PATCH83U_RUN009_REQUIRED_REQUIREMENTS_INCOMPLETE');
  }
  return Object.freeze({
    passed: true,
    phase_count: contract.phases.length,
    requirement_count: requirements.length,
    requirement_ids: Object.freeze([...ids]),
  });
}

export function validateRun009Traceability(traceability, proofContract) {
  const proofValidation = validateRun009ProofContract(proofContract);
  exactKeys(traceability, [
    'schema_version',
    'contract_id',
    'run_number',
    'requirement_count',
    'mapped_requirement_count',
    'coverage_percent',
    'complete',
    'requirements',
  ], 'PATCH83U_RUN009_TRACEABILITY_SHAPE_INVALID');
  if (
    traceability.schema_version !== RUN009_TRACEABILITY_VERSION
    || traceability.contract_id !== RUN009_PROOF_CONTRACT_ID
    || traceability.run_number !== 9
    || traceability.requirement_count !== proofValidation.requirement_count
    || traceability.mapped_requirement_count !== proofValidation.requirement_count
    || traceability.coverage_percent !== 100
    || traceability.complete !== true
    || !Array.isArray(traceability.requirements)
    || traceability.requirements.length !== proofValidation.requirement_count
  ) {
    fail('PATCH83U_RUN009_TRACEABILITY_SUMMARY_INVALID');
  }

  const proofRequirements = new Map(
    requirementIndex(proofContract).map((requirement) => [
      requirement.id,
      requirement,
    ]),
  );
  const seen = new Set();
  for (const row of traceability.requirements) {
    exactKeys(row, [
      'requirement_id',
      'source_requirement',
      'sql_checkpoint_field',
      'schema_path',
      'harness_assertion',
      'unit_test',
      'execution_phase',
      'failure_code',
      'evidence_field',
    ], 'PATCH83U_RUN009_TRACEABILITY_ROW_SHAPE_INVALID');
    const proofRequirement = proofRequirements.get(row.requirement_id);
    if (!proofRequirement || seen.has(row.requirement_id)) {
      fail('PATCH83U_RUN009_TRACEABILITY_REQUIREMENT_INVALID', row.requirement_id);
    }
    seen.add(row.requirement_id);
    if (
      row.source_requirement !== proofRequirement.condition
      || row.execution_phase !== proofRequirement.phase
      || !(
        row.sql_checkpoint_field === null
        || (
          typeof row.sql_checkpoint_field === 'string'
          && row.sql_checkpoint_field.trim() !== ''
        )
      )
    ) {
      fail('PATCH83U_RUN009_TRACEABILITY_MAPPING_INVALID', row.requirement_id);
    }
    for (const [field, code] of [
      ['schema_path', 'PATCH83U_RUN009_TRACEABILITY_SCHEMA_PATH_MISSING'],
      ['harness_assertion', 'PATCH83U_RUN009_TRACEABILITY_ASSERTION_MISSING'],
      ['unit_test', 'PATCH83U_RUN009_TRACEABILITY_TEST_MISSING'],
      ['evidence_field', 'PATCH83U_RUN009_TRACEABILITY_EVIDENCE_FIELD_MISSING'],
    ]) {
      nonEmptyString(row[field], code);
    }
    if (!SAFE_FAILURE_CODE_PATTERN.test(row.failure_code)) {
      fail('PATCH83U_RUN009_TRACEABILITY_FAILURE_CODE_INVALID', row.requirement_id);
    }
  }
  if (
    seen.size !== RUN009_REQUIRED_REQUIREMENT_IDS.length
    || RUN009_REQUIRED_REQUIREMENT_IDS.some((id) => !seen.has(id))
  ) {
    fail('PATCH83U_RUN009_TRACEABILITY_INCOMPLETE');
  }
  return Object.freeze({
    passed: true,
    requirement_count: proofValidation.requirement_count,
    mapped_count: seen.size,
    coverage_percent: 100,
  });
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function pathWithin(directory, candidate) {
  const fromDirectory = relative(directory, candidate);
  return fromDirectory === ''
    || (!fromDirectory.startsWith('..') && !isAbsolute(fromDirectory));
}

function decodeJsonPointerSegment(segment) {
  return segment.replaceAll('~1', '/').replaceAll('~0', '~');
}

function resolveJsonPointer(document, pointer, code) {
  if (pointer === '' || pointer === '#') return document;
  if (!pointer.startsWith('#/')) fail(code, pointer);
  let current = document;
  for (const segment of pointer.slice(2).split('/').map(decodeJsonPointerSegment)) {
    if (
      current === null
      || typeof current !== 'object'
      || !Object.hasOwn(current, segment)
    ) {
      fail(code, pointer);
    }
    current = current[segment];
  }
  return current;
}

function splitArtifactPointer(reference, code) {
  const hashIndex = reference.indexOf('#');
  if (
    hashIndex < 1
    || reference.indexOf('#', hashIndex + 1) !== -1
  ) {
    fail(code, reference);
  }
  return {
    path: reference.slice(0, hashIndex),
    pointer: reference.slice(hashIndex),
  };
}

async function readRepositoryArtifact(repositoryRoot, candidatePath, code) {
  if (
    typeof candidatePath !== 'string'
    || candidatePath.trim() === ''
    || isAbsolute(candidatePath)
    || candidatePath.includes('\\')
  ) {
    fail(code);
  }
  const rootRealPath = await realpath(repositoryRoot);
  const artifactRealPath = await realpath(resolve(rootRealPath, candidatePath));
  if (!pathWithin(rootRealPath, artifactRealPath)) fail(code);
  return readFile(artifactRealPath);
}

async function resolveArtifactJsonPointer(
  repositoryRoot,
  reference,
  {
    pathCode,
    jsonCode,
    pointerCode,
    cache,
  },
) {
  const { path, pointer } = splitArtifactPointer(reference, pathCode);
  let document = cache.get(path);
  if (!document) {
    const bytes = await readRepositoryArtifact(repositoryRoot, path, pathCode);
    try {
      document = JSON.parse(bytes.toString('utf8'));
    } catch {
      fail(jsonCode, path);
    }
    cache.set(path, document);
  }
  resolveJsonPointer(document, pointer, pointerCode);
  return path;
}

function checkpointSqlBlocks(sql) {
  const starts = [...sql.matchAll(/^-- CHECKPOINT ([1-6]):[^\r\n]*$/gm)];
  const blocks = new Map();
  for (let index = 0; index < starts.length; index += 1) {
    const current = starts[index];
    const number = Number(current[1]);
    const end = starts[index + 1]?.index ?? sql.length;
    if (blocks.has(number)) {
      fail('PATCH83U_RUN009_SQL_CHECKPOINT_BLOCK_DUPLICATE', String(number));
    }
    blocks.set(number, sql.slice(current.index, end));
  }
  if (
    blocks.size !== 6
    || [1, 2, 3, 4, 5, 6].some((number) => !blocks.has(number))
  ) {
    fail('PATCH83U_RUN009_SQL_CHECKPOINT_BLOCK_INCOMPLETE');
  }
  return blocks;
}

const CHECKPOINT_NUMBERS = Object.freeze({
  before_employee_sessions: 1,
  immediately_before_reset: 2,
  immediately_after_reset: 3,
  before_required_password_change: 4,
  immediately_after_password_change_finalization: 5,
  after_fresh_employee_login: 6,
});

function checkpointTargetSql(block, checkpoint) {
  const match = /target_snapshot\s+AS\s*\(\s*SELECT([\s\S]*?)\n\),\s*admin_snapshot\s+AS\s*\(/i
    .exec(block);
  if (
    !match
    || !/['"]target['"]\s*,\s*\(SELECT\s+to_jsonb\(target_snapshot\)/i.test(block)
  ) {
    fail('PATCH83U_RUN009_SQL_TARGET_EMISSION_MISSING', checkpoint);
  }
  return match[1];
}

function schemaReferenceTarget(rootSchema, node, code) {
  let current = node;
  const seen = new Set();
  while (current && typeof current === 'object' && typeof current.$ref === 'string') {
    if (
      !current.$ref.startsWith('#/')
      || seen.has(current.$ref)
    ) {
      fail(code, current.$ref);
    }
    seen.add(current.$ref);
    current = resolveJsonPointer(rootSchema, current.$ref, code);
  }
  return objectValue(current, code);
}

function checkpointSchemaBranch(rootSchema, checkpoint) {
  if (!Array.isArray(rootSchema.oneOf)) {
    fail('PATCH83U_RUN009_CHECKPOINT_SCHEMA_ONE_OF_REQUIRED');
  }
  const candidates = rootSchema.oneOf
    .map((node) => schemaReferenceTarget(
      rootSchema,
      node,
      'PATCH83U_RUN009_CHECKPOINT_SCHEMA_REF_INVALID',
    ))
    .filter((branch) => {
      const checkpointSchema = branch.properties?.checkpoint;
      return checkpointSchema?.const === checkpoint
        || (
          Array.isArray(checkpointSchema?.enum)
          && checkpointSchema.enum.includes(checkpoint)
        );
    });
  if (candidates.length !== 1) {
    fail(
      'PATCH83U_RUN009_CHECKPOINT_SCHEMA_PHASE_BRANCH_NOT_EXACT',
      checkpoint,
    );
  }
  return candidates[0];
}

function expectedTargetValues(checkpointContract) {
  return checkpointContract.expected
    ?? checkpointContract.successful_expected
    ?? {};
}

function assertExpectedFieldSchema(
  fieldSchema,
  expectedField,
  expectedValue,
  checkpoint,
) {
  if (expectedField.startsWith('minimum_')) {
    const targetField = expectedField.slice('minimum_'.length);
    if (
      fieldSchema.minimum !== expectedValue
      && fieldSchema.const !== expectedValue
    ) {
      fail(
        'PATCH83U_RUN009_CHECKPOINT_SCHEMA_MINIMUM_NOT_BOUND',
        `${checkpoint}.${targetField}`,
      );
    }
    return;
  }
  if (fieldSchema.const !== expectedValue) {
    fail(
      'PATCH83U_RUN009_CHECKPOINT_SCHEMA_EXPECTATION_NOT_EXACT',
      `${checkpoint}.${expectedField}`,
    );
  }
}

function schemaPermitsExpectedValue(fieldSchema, expectedValue) {
  if (
    Object.hasOwn(fieldSchema, 'const')
    && fieldSchema.const !== expectedValue
  ) {
    return false;
  }
  if (
    Array.isArray(fieldSchema.enum)
    && !fieldSchema.enum.includes(expectedValue)
  ) {
    return false;
  }
  if (
    fieldSchema.type === 'integer'
    && !Number.isSafeInteger(expectedValue)
  ) {
    return false;
  }
  if (
    fieldSchema.type === 'boolean'
    && typeof expectedValue !== 'boolean'
  ) {
    return false;
  }
  if (
    fieldSchema.type === 'string'
    && typeof expectedValue !== 'string'
  ) {
    return false;
  }
  if (
    typeof expectedValue === 'number'
    && (
      (
        Number.isFinite(fieldSchema.minimum)
        && expectedValue < fieldSchema.minimum
      )
      || (
        Number.isFinite(fieldSchema.maximum)
        && expectedValue > fieldSchema.maximum
      )
    )
  ) {
    return false;
  }
  return true;
}

function auditCheckpointContractsAgainstSqlAndSchema({
  proofContract,
  sqlBlocks,
  checkpointSchema,
  harnessSource,
}) {
  const details = [];
  let requiredFieldCount = 0;
  let expectedFieldCount = 0;
  let exactExpectationCount = 0;
  let conditionalExpectationCount = 0;
  for (const checkpoint of CHECKPOINT_NAMES) {
    const contract = proofContract.checkpoint_contracts[checkpoint];
    const checkpointNumber = CHECKPOINT_NUMBERS[checkpoint];
    const block = sqlBlocks.get(checkpointNumber);
    const targetSql = checkpointTargetSql(block, checkpoint);
    const branch = checkpointSchemaBranch(checkpointSchema, checkpoint);
    const targetProperty = branch.properties?.target;
    if (
      !Array.isArray(branch.required)
      || !branch.required.includes('target')
      || !targetProperty
    ) {
      fail('PATCH83U_RUN009_CHECKPOINT_SCHEMA_TARGET_REQUIRED', checkpoint);
    }
    const targetSchema = schemaReferenceTarget(
      checkpointSchema,
      targetProperty,
      'PATCH83U_RUN009_CHECKPOINT_TARGET_SCHEMA_REF_INVALID',
    );
    if (
      targetSchema.additionalProperties !== false
      || !Array.isArray(targetSchema.required)
      || !targetSchema.properties
    ) {
      fail('PATCH83U_RUN009_CHECKPOINT_TARGET_SCHEMA_OPEN', checkpoint);
    }

    for (const field of contract.required_target_fields) {
      if (!new RegExp(`\\b${escapeRegularExpression(field)}\\b`).test(targetSql)) {
        fail(
          'PATCH83U_RUN009_CHECKPOINT_SQL_TARGET_FIELD_MISSING',
          `${checkpoint}.${field}`,
        );
      }
      if (
        !targetSchema.required.includes(field)
        || !Object.hasOwn(targetSchema.properties, field)
      ) {
        fail(
          'PATCH83U_RUN009_CHECKPOINT_SCHEMA_TARGET_FIELD_MISSING',
          `${checkpoint}.${field}`,
        );
      }
      requiredFieldCount += 1;
    }

    const expectations = expectedTargetValues(contract);
    for (const [expectedField, expectedValue] of Object.entries(expectations)) {
      const targetField = expectedField.startsWith('minimum_')
        ? expectedField.slice('minimum_'.length)
        : expectedField;
      if (
        !contract.required_target_fields.includes(targetField)
        || !targetSchema.required.includes(targetField)
        || !Object.hasOwn(targetSchema.properties, targetField)
      ) {
        fail(
          'PATCH83U_RUN009_CHECKPOINT_EXPECTED_FIELD_NOT_REQUIRED',
          `${checkpoint}.${targetField}`,
        );
      }
      const fieldSchema = schemaReferenceTarget(
        checkpointSchema,
        targetSchema.properties[targetField],
        'PATCH83U_RUN009_CHECKPOINT_FIELD_SCHEMA_REF_INVALID',
      );
      if (contract.required_for_every_reset_outcome === true) {
        if (
          !schemaPermitsExpectedValue(fieldSchema, expectedValue)
          || !harnessSource.includes('classifyPostResetCheckpoint')
          || !harnessSource.includes('evaluateResetProgression')
        ) {
          fail(
            'PATCH83U_RUN009_CHECKPOINT_CONDITIONAL_SUCCESS_NOT_ENFORCED',
            `${checkpoint}.${targetField}`,
          );
        }
        conditionalExpectationCount += 1;
      } else {
        assertExpectedFieldSchema(
          fieldSchema,
          expectedField,
          expectedValue,
          checkpoint,
        );
        exactExpectationCount += 1;
      }
      expectedFieldCount += 1;
    }
    details.push(Object.freeze({
      checkpoint,
      checkpoint_number: checkpointNumber,
      required_target_field_count: contract.required_target_fields.length,
      sql_target_field_count: contract.required_target_fields.length,
      schema_required_field_count: contract.required_target_fields.length,
      expected_field_count: Object.keys(expectations).length,
      schema_exact_expectation_count:
        contract.required_for_every_reset_outcome === true
          ? 0
          : Object.keys(expectations).length,
      harness_conditional_expectation_count:
        contract.required_for_every_reset_outcome === true
          ? Object.keys(expectations).length
          : 0,
    }));
  }
  return Object.freeze({
    checkpoint_count: details.length,
    required_target_field_count: requiredFieldCount,
    sql_target_field_count: requiredFieldCount,
    schema_required_field_count: requiredFieldCount,
    expected_field_count: expectedFieldCount,
    schema_exact_expectation_count: exactExpectationCount,
    harness_conditional_expectation_count: conditionalExpectationCount,
    total_expectation_coverage_count:
      exactExpectationCount + conditionalExpectationCount,
    checkpoints: Object.freeze(details),
  });
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertSqlCheckpointMapping(mapping, blocks, requirementId) {
  if (mapping === null) return;
  const match = /^checkpoint_([1-6])(?:\.([a-z_][a-z0-9_]*))?\.([a-z_][a-z0-9_]*)$/
    .exec(mapping);
  if (!match) {
    fail('PATCH83U_RUN009_TRACEABILITY_SQL_FIELD_INVALID', requirementId);
  }
  const checkpointNumber = Number(match[1]);
  const section = match[2] ?? null;
  const field = match[3];
  const block = blocks.get(checkpointNumber);
  if (
    (section && !new RegExp(`['"]${escapeRegularExpression(section)}['"]`).test(block))
    || !new RegExp(`\\b${escapeRegularExpression(field)}\\b`).test(block)
  ) {
    fail('PATCH83U_RUN009_TRACEABILITY_SQL_FIELD_UNRESOLVED', requirementId);
  }
}

export async function auditRun009StaticCoverage({
  traceability,
  proofContract,
  repositoryRoot = process.cwd(),
} = {}) {
  objectValue(traceability, 'PATCH83U_RUN009_TRACEABILITY_REQUIRED');
  objectValue(proofContract, 'PATCH83U_RUN009_PROOF_CONTRACT_REQUIRED');
  const [harnessBytes, sqlBytes, auditBytes] = await Promise.all([
    readRepositoryArtifact(
      repositoryRoot,
      RUN009_HARNESS_PATH,
      'PATCH83U_RUN009_HARNESS_PATH_REFUSED',
    ),
    readRepositoryArtifact(
      repositoryRoot,
      RUN009_SQL_CHECKPOINT_PATH,
      'PATCH83U_RUN009_SQL_PATH_REFUSED',
    ),
    readRepositoryArtifact(
      repositoryRoot,
      'scripts/patch83u-run009-contract-audit.mjs',
      'PATCH83U_RUN009_AUDIT_PATH_REFUSED',
    ),
  ]);
  const harnessSource = harnessBytes.toString('utf8');
  const auditSource = auditBytes.toString('utf8');
  const sqlBlocks = checkpointSqlBlocks(sqlBytes.toString('utf8'));
  const jsonCache = new Map();
  const sourceCache = new Map([
    [RUN009_HARNESS_PATH, harnessSource],
    ['scripts/patch83u-run009-contract-audit.mjs', auditSource],
  ]);
  let covered = 0;

  for (const row of traceability.requirements) {
    await resolveArtifactJsonPointer(
      repositoryRoot,
      row.schema_path,
      {
        pathCode: 'PATCH83U_RUN009_TRACEABILITY_SCHEMA_PATH_REFUSED',
        jsonCode: 'PATCH83U_RUN009_TRACEABILITY_SCHEMA_JSON_INVALID',
        pointerCode: 'PATCH83U_RUN009_TRACEABILITY_SCHEMA_POINTER_UNRESOLVED',
        cache: jsonCache,
      },
    );
    await resolveArtifactJsonPointer(
      repositoryRoot,
      row.evidence_field,
      {
        pathCode: 'PATCH83U_RUN009_TRACEABILITY_EVIDENCE_PATH_REFUSED',
        jsonCode: 'PATCH83U_RUN009_TRACEABILITY_EVIDENCE_JSON_INVALID',
        pointerCode: 'PATCH83U_RUN009_TRACEABILITY_EVIDENCE_POINTER_UNRESOLVED',
        cache: jsonCache,
      },
    );

    if (
      !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(row.harness_assertion)
      || !new RegExp(
        `\\b${escapeRegularExpression(row.harness_assertion)}\\b`,
      ).test(`${harnessSource}\n${auditSource}`)
    ) {
      fail(
        'PATCH83U_RUN009_TRACEABILITY_ASSERTION_UNRESOLVED',
        row.requirement_id,
      );
    }

    const testReference = splitArtifactPointer(
      row.unit_test,
      'PATCH83U_RUN009_TRACEABILITY_TEST_REFERENCE_INVALID',
    );
    let testSource = sourceCache.get(testReference.path);
    if (!testSource) {
      const testBytes = await readRepositoryArtifact(
        repositoryRoot,
        testReference.path,
        'PATCH83U_RUN009_TRACEABILITY_TEST_PATH_REFUSED',
      );
      testSource = testBytes.toString('utf8');
      sourceCache.set(testReference.path, testSource);
    }
    const testTitle = testReference.pointer.slice(1);
    if (
      testTitle === ''
      || !testSource.includes(testTitle)
    ) {
      fail('PATCH83U_RUN009_TRACEABILITY_TEST_UNRESOLVED', row.requirement_id);
    }

    assertSqlCheckpointMapping(
      row.sql_checkpoint_field,
      sqlBlocks,
      row.requirement_id,
    );
    if (
      !harnessSource.includes(row.failure_code)
      && !auditSource.includes(row.failure_code)
      && !testSource.includes(row.failure_code)
    ) {
      fail(
        'PATCH83U_RUN009_TRACEABILITY_FAILURE_CODE_UNRESOLVED',
        row.requirement_id,
      );
    }
    covered += 1;
  }
  if (covered !== RUN009_REQUIRED_REQUIREMENT_IDS.length) {
    fail('PATCH83U_RUN009_STATIC_COVERAGE_INCOMPLETE');
  }
  const checkpointSchemaBytes = await readRepositoryArtifact(
    repositoryRoot,
    RUN009_CHECKPOINT_SCHEMA_PATH,
    'PATCH83U_RUN009_CHECKPOINT_SCHEMA_PATH_REFUSED',
  );
  let checkpointSchema;
  try {
    checkpointSchema = JSON.parse(checkpointSchemaBytes.toString('utf8'));
  } catch {
    fail('PATCH83U_RUN009_CHECKPOINT_SCHEMA_JSON_INVALID');
  }
  const checkpointFieldCoverage = auditCheckpointContractsAgainstSqlAndSchema({
    proofContract,
    sqlBlocks,
    checkpointSchema,
    harnessSource,
  });
  return Object.freeze({
    passed: true,
    static_coverage_count: covered,
    checkpoint_field_coverage: checkpointFieldCoverage,
  });
}

async function readBoundArtifact(repositoryRoot, expectedPath, candidatePath, code) {
  if (candidatePath !== expectedPath || isAbsolute(candidatePath)) fail(code);
  const rootRealPath = await realpath(repositoryRoot);
  const releaseRealPath = await realpath(resolve(rootRealPath, 'release', 'patch83u'));
  const artifactRealPath = await realpath(resolve(rootRealPath, candidatePath));
  if (!pathWithin(releaseRealPath, artifactRealPath)) fail(code);
  const bytes = await readFile(artifactRealPath);
  return {
    bytes,
    sha256: sha256(bytes),
    size: bytes.length,
  };
}

export async function verifyRun009ContractArtifacts({
  freeze,
  repositoryRoot = process.cwd(),
} = {}) {
  objectValue(freeze, 'PATCH83U_RUN009_FREEZE_REQUIRED');
  const proofBinding = objectValue(
    freeze.proof_contract,
    'PATCH83U_RUN009_PROOF_BINDING_REQUIRED',
  );
  const traceabilityBinding = objectValue(
    freeze.traceability,
    'PATCH83U_RUN009_TRACEABILITY_BINDING_REQUIRED',
  );
  const checkpointSchemaBinding = objectValue(
    freeze.checkpoint_schema,
    'PATCH83U_RUN009_CHECKPOINT_SCHEMA_BINDING_REQUIRED',
  );
  const runContract = objectValue(
    freeze.run_contract,
    'PATCH83U_RUN009_RUN_CONTRACT_REQUIRED',
  );
  const [proofArtifact, traceabilityArtifact, markdownArtifact,
    checkpointSchemaArtifact, evidenceSchemaArtifact] =
    await Promise.all([
      readBoundArtifact(
        repositoryRoot,
        RUN009_PROOF_CONTRACT_PATH,
        proofBinding.path,
        'PATCH83U_RUN009_PROOF_CONTRACT_PATH_REFUSED',
      ),
      readBoundArtifact(
        repositoryRoot,
        RUN009_TRACEABILITY_PATH,
        traceabilityBinding.json_path,
        'PATCH83U_RUN009_TRACEABILITY_PATH_REFUSED',
      ),
      readBoundArtifact(
        repositoryRoot,
        RUN009_TRACEABILITY_MARKDOWN_PATH,
        traceabilityBinding.markdown_path,
        'PATCH83U_RUN009_TRACEABILITY_MARKDOWN_PATH_REFUSED',
      ),
      readBoundArtifact(
        repositoryRoot,
        RUN009_CHECKPOINT_SCHEMA_PATH,
        checkpointSchemaBinding.path,
        'PATCH83U_RUN009_CHECKPOINT_SCHEMA_PATH_REFUSED',
      ),
      readBoundArtifact(
        repositoryRoot,
        RUN009_EVIDENCE_SCHEMA_PATH,
        runContract.evidence_schema_path,
        'PATCH83U_RUN009_EVIDENCE_SCHEMA_PATH_REFUSED',
      ),
    ]);

  if (
    proofArtifact.sha256 !== proofBinding.sha256
    || proofArtifact.size !== proofBinding.bytes
    || !SHA256_PATTERN.test(String(proofBinding.sha256 ?? ''))
  ) {
    fail('PATCH83U_RUN009_PROOF_CONTRACT_HASH_MISMATCH');
  }
  if (
    traceabilityArtifact.sha256 !== traceabilityBinding.json_sha256
    || traceabilityArtifact.size !== traceabilityBinding.json_bytes
    || !SHA256_PATTERN.test(String(traceabilityBinding.json_sha256 ?? ''))
  ) {
    fail('PATCH83U_RUN009_TRACEABILITY_HASH_MISMATCH');
  }
  if (
    markdownArtifact.sha256 !== traceabilityBinding.markdown_sha256
    || markdownArtifact.size !== traceabilityBinding.markdown_bytes
    || !SHA256_PATTERN.test(String(traceabilityBinding.markdown_sha256 ?? ''))
  ) {
    fail('PATCH83U_RUN009_TRACEABILITY_MARKDOWN_HASH_MISMATCH');
  }
  if (
    checkpointSchemaArtifact.sha256 !== checkpointSchemaBinding.sha256
    || checkpointSchemaArtifact.size !== checkpointSchemaBinding.bytes
    || !SHA256_PATTERN.test(String(checkpointSchemaBinding.sha256 ?? ''))
  ) {
    fail('PATCH83U_RUN009_CHECKPOINT_SCHEMA_HASH_MISMATCH');
  }
  if (
    evidenceSchemaArtifact.sha256 !== runContract.evidence_schema_sha256
    || evidenceSchemaArtifact.size !== runContract.evidence_schema_bytes
    || !SHA256_PATTERN.test(String(runContract.evidence_schema_sha256 ?? ''))
  ) {
    fail('PATCH83U_RUN009_EVIDENCE_SCHEMA_HASH_MISMATCH');
  }

  let proofContract;
  let traceability;
  try {
    proofContract = JSON.parse(proofArtifact.bytes.toString('utf8'));
  } catch {
    fail('PATCH83U_RUN009_PROOF_CONTRACT_JSON_INVALID');
  }
  try {
    traceability = JSON.parse(traceabilityArtifact.bytes.toString('utf8'));
  } catch {
    fail('PATCH83U_RUN009_TRACEABILITY_JSON_INVALID');
  }
  const proofValidation = validateRun009ProofContract(proofContract);
  const traceabilityValidation =
    validateRun009Traceability(traceability, proofContract);
  const staticCoverage = await auditRun009StaticCoverage({
    traceability,
    proofContract,
    repositoryRoot,
  });
  const markdown = markdownArtifact.bytes.toString('utf8');
  for (const requirementId of RUN009_REQUIRED_REQUIREMENT_IDS) {
    if (!markdown.includes(requirementId)) {
      fail('PATCH83U_RUN009_TRACEABILITY_MARKDOWN_INCOMPLETE', requirementId);
    }
  }
  if (
    proofBinding.schema_version !== RUN009_PROOF_CONTRACT_VERSION
    || proofBinding.contract_id !== RUN009_PROOF_CONTRACT_ID
    || proofBinding.requirement_count !== proofValidation.requirement_count
    || traceabilityBinding.schema_version !== RUN009_TRACEABILITY_VERSION
    || traceabilityBinding.requirement_count !== proofValidation.requirement_count
    || traceabilityBinding.mapped_requirement_count
      !== traceabilityValidation.mapped_count
    || traceabilityBinding.coverage_percent !== 100
    || traceabilityBinding.complete !== true
    || checkpointSchemaBinding.schema_version
      !== 'patch83u-staging-sql-editor-checkpoint-file-v3'
    || runContract.evidence_schema_version
      !== 'patch83u-staging-reset-proof-v8'
    || staticCoverage.static_coverage_count !== proofValidation.requirement_count
  ) {
    fail('PATCH83U_RUN009_CONTRACT_FREEZE_BINDING_INVALID');
  }
  const frozenFinalSession = freeze.final_session_contract;
  if (
    JSON.stringify(frozenFinalSession)
      !== JSON.stringify(proofContract.final_session_contract)
  ) {
    fail('PATCH83U_RUN009_FINAL_SESSION_FREEZE_BINDING_MISMATCH');
  }
  const frozenConfirmation = freeze.operator_confirmation_contract;
  if (
    frozenConfirmation?.contract_id !== proofContract.confirmation_contract.contract_id
    || frozenConfirmation?.exact_phrase
      !== proofContract.confirmation_contract.exact_phrase
    || frozenConfirmation?.case_sensitive !== true
    || frozenConfirmation?.cli_override_supported !== false
  ) {
    fail('PATCH83U_RUN009_CONFIRMATION_FREEZE_BINDING_MISMATCH');
  }
  return Object.freeze({
    passed: true,
    requirement_count: proofValidation.requirement_count,
    mapped_count: traceabilityValidation.mapped_count,
    coverage_percent: traceabilityValidation.coverage_percent,
    static_coverage_count: staticCoverage.static_coverage_count,
    checkpoint_field_coverage: staticCoverage.checkpoint_field_coverage,
    proof_contract: proofContract,
    traceability,
  });
}

async function main() {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const [proofContract, traceability] = await Promise.all([
    readFile(resolve(root, RUN009_PROOF_CONTRACT_PATH), 'utf8').then(JSON.parse),
    readFile(resolve(root, RUN009_TRACEABILITY_PATH), 'utf8').then(JSON.parse),
  ]);
  const result = validateRun009Traceability(traceability, proofContract);
  const staticCoverage = await auditRun009StaticCoverage({
    traceability,
    proofContract,
    repositoryRoot: root,
  });
  process.stdout.write(
    `PATCH83U RUN009 CONTRACT TRACEABILITY PASSED `
    + `${result.mapped_count}/${result.requirement_count}; STATIC `
    + `${staticCoverage.static_coverage_count}/${result.requirement_count}\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'PATCH83U_RUN009_CONTRACT_AUDIT_FAILED'}\n`,
    );
    process.exitCode = 1;
  });
}
