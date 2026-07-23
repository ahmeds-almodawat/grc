import { createHash } from 'node:crypto';

type JsonObject = Record<string, any>;

function readPointer(value: JsonObject, pointer: string) {
  let current: any = value;
  for (const raw of pointer.slice(1).split('/')) {
    const segment = raw.replaceAll('~1', '/').replaceAll('~0', '~');
    if (!current || typeof current !== 'object'
      || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return { present: false, value: undefined };
    }
    current = current[segment];
  }
  return { present: true, value: current };
}

function aggregate(files: Array<{ path: string; sha256: string; bytes: number }>) {
  const payload = [...files]
    .sort((left, right) => (
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0
    ))
    .map((file) => `${file.path}\t${file.sha256}\t${file.bytes}`)
    .join('\n');
  return createHash('sha256').update(payload).digest('hex');
}

export function historicalPointersForSchema(
  currentPointers: readonly string[],
  schema: JsonObject,
) {
  return currentPointers.filter((pointer) => {
    let node: any = schema;
    for (const raw of pointer.slice(1).split('/')) {
      const segment = raw.replaceAll('~1', '/').replaceAll('~0', '~');
      if (node?.$ref) {
        node = node.$ref.slice(2).split('/').reduce(
          (value: any, part: string) => value?.[part],
          schema,
        );
      }
      if (!node?.properties?.[segment]) return false;
      node = node.properties[segment];
    }
    return true;
  });
}

export function createHistoricalFreezeAssertions({
  capturedFreeze,
  consumedPointers,
  runNumber,
}: {
  capturedFreeze: JsonObject;
  consumedPointers: readonly string[];
  runNumber: 7 | 8;
}) {
  const confirmationError =
    `PATCH83U_RUN${String(runNumber).padStart(3, '0')}_CONFIRMATION_AND_FINAL_SESSION_CONTRACTS_FAILED`;

  function assertConsumedFields(freeze: JsonObject) {
    for (const pointer of consumedPointers) {
      if (!readPointer(freeze, pointer).present) {
        throw new Error(`PATCH83U_EXECUTION_FREEZE_CONSUMED_FIELD_MISSING:${pointer}`);
      }
    }
    return true;
  }

  function assertSemanticContract(freeze: JsonObject) {
    assertConsumedFields(freeze);
    const confirmation = freeze.operator_confirmation_contract;
    const finalSession = freeze.final_session_contract;
    if (
      confirmation?.contract_id
        !== capturedFreeze.operator_confirmation_contract.contract_id
      || confirmation?.run_number !== runNumber
      || confirmation?.exact_phrase
        !== capturedFreeze.operator_confirmation_contract.exact_phrase
      || confirmation?.case_sensitive !== true
      || confirmation?.cli_override_supported !== false
      || confirmation?.required_immediately_before_reset !== true
      || confirmation?.evidence_retention !== 'boolean_and_contract_id_only'
      || finalSession?.checkpoint !== 'after_fresh_employee_login'
      || finalSession?.expected_session_count !== 1
      || finalSession?.expected_unrevoked_refresh_token_count !== 1
      || finalSession?.enforcement !== 'exact_integer_equality'
      || finalSession?.cli_override_supported !== false
    ) throw new Error(confirmationError);

    const metadata = freeze.active_edge_provenance.metadata;
    if (
      new Date(metadata.created_at_unix_ms).toISOString() !== metadata.created_at_utc
      || new Date(metadata.updated_at_unix_ms).toISOString() !== metadata.updated_at_utc
    ) throw new Error('PATCH83U_EXECUTION_FREEZE_EDGE_TIMESTAMP_NOT_CANONICAL');

    const expectedRun = capturedFreeze.run_contract;
    const expectedProof = capturedFreeze.proof_contract;
    const expectedCheckpoint = capturedFreeze.checkpoint_schema;
    const expectedTraceability = capturedFreeze.traceability;
    if (
      freeze.targets.application_origin !== capturedFreeze.targets.application_origin
      || freeze.targets.staging_supabase_origin
        !== capturedFreeze.targets.staging_supabase_origin
      || freeze.run_contract.run_number !== runNumber
      || freeze.run_contract.evidence_directory !== expectedRun.evidence_directory
      || freeze.run_contract.checkpoint_directory !== expectedRun.checkpoint_directory
      || freeze.run_contract.output_path_pattern !== expectedRun.output_path_pattern
      || freeze.run_contract.evidence_schema_path !== expectedRun.evidence_schema_path
      || freeze.run_contract.evidence_schema_version
        !== expectedRun.evidence_schema_version
      || freeze.proof_contract.path !== expectedProof.path
      || freeze.proof_contract.schema_version !== expectedProof.schema_version
      || freeze.proof_contract.contract_id !== expectedProof.contract_id
      || freeze.checkpoint_schema.path !== expectedCheckpoint.path
      || freeze.checkpoint_schema.schema_version !== expectedCheckpoint.schema_version
      || freeze.traceability.json_path !== expectedTraceability.json_path
      || freeze.traceability.markdown_path !== expectedTraceability.markdown_path
      || freeze.traceability.schema_version !== expectedTraceability.schema_version
      || freeze.traceability.complete !== true
      || freeze.traceability.coverage_percent !== 100
      || freeze.traceability.requirement_count !== freeze.proof_contract.requirement_count
      || freeze.traceability.mapped_requirement_count
        !== freeze.proof_contract.requirement_count
    ) throw new Error('PATCH83U_EXECUTION_FREEZE_RUN_CONTRACT_MISMATCH');

    for (const manifest of [freeze.frozen_source, freeze.prior_evidence_integrity]) {
      if (
        aggregate(manifest.files) !== manifest.aggregate_sha256
        || manifest.files.reduce((sum: number, file: any) => sum + file.bytes, 0)
          !== manifest.total_bytes
        || manifest.files.length !== manifest.file_count
      ) throw new Error('PATCH83U_EXECUTION_FREEZE_MANIFEST_CONTRACT_MISMATCH');
    }
    return true;
  }

  return {
    assertExecutionFreezeConsumedFields: assertConsumedFields,
    assertExecutionFreezeSemanticContract: assertSemanticContract,
  };
}
