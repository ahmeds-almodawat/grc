export const E2B3_TRAINING_RECONCILIATION_CONTRACT = {
  contract_version: 'e2b3-training-population-v1',
  schema_version: 209,
  reconciliation_available: true,
} as const;

export interface E2B3TrainingReconciliationCapability {
  contract_version?: unknown;
  schema_version?: unknown;
  reconciliation_available?: unknown;
  [key: string]: unknown;
}

export function hasExactE2B3TrainingReconciliationCapability(
  value: unknown,
): value is typeof E2B3_TRAINING_RECONCILIATION_CONTRACT {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const capability = value as E2B3TrainingReconciliationCapability;
  const keys = Object.keys(capability).sort();
  return keys.length === 3
    && keys[0] === 'contract_version'
    && keys[1] === 'reconciliation_available'
    && keys[2] === 'schema_version'
    && capability.contract_version === E2B3_TRAINING_RECONCILIATION_CONTRACT.contract_version
    && capability.schema_version === E2B3_TRAINING_RECONCILIATION_CONTRACT.schema_version
    && capability.reconciliation_available === true;
}

export function isE2B3Migration209CapabilityUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const code = String(candidate.code ?? '');
  const message = [candidate.message, candidate.details, candidate.hint]
    .filter((part) => typeof part === 'string')
    .join(' ')
    .toLowerCase();
  return code === 'PGRST202'
    || code === '42883'
    || message.includes('get_e2b3_training_reconciliation_capabilities')
      && (message.includes('not find') || message.includes('does not exist'));
}
