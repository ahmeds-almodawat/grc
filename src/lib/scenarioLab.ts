import { invokePrivilegedAction } from './privilegedAction';

export const V99_SCENARIO_TAG = 'V99_SCENARIO_LAB';

export const isScenarioLabEnabled =
  import.meta.env.DEV
  || import.meta.env.VITE_CONTROLLED_PILOT_MODE === 'true';

export type V99ScenarioCode =
  | 'ovr_same_department'
  | 'ovr_cross_department'
  | 'ovr_high_severity'
  | 'ovr_returned_clarification'
  | 'ovr_disputed_reopened'
  | 'risk'
  | 'control'
  | 'evidence'
  | 'project'
  | 'full';

export interface ScenarioLabResult {
  scenario: string;
  record_type?: string;
  id?: string;
  status?: string;
  ovr_number?: string;
  record_count?: number;
  records?: ScenarioLabResult[];
  test_dataset_tag: typeof V99_SCENARIO_TAG;
  [key: string]: unknown;
}

export interface ScenarioLabStatus {
  test_dataset_tag: typeof V99_SCENARIO_TAG;
  total_records: number;
  by_table: Record<string, number>;
  by_scenario: Record<string, number>;
}

export interface ScenarioCleanupResult {
  status: 'cleaned';
  test_dataset_tag: typeof V99_SCENARIO_TAG;
  deleted: Record<string, number>;
}

export async function createScenarioLabScenario(scenario: V99ScenarioCode) {
  if (!isScenarioLabEnabled) {
    throw new Error('Scenario Lab is disabled outside local development or controlled pilot mode.');
  }
  return invokePrivilegedAction<ScenarioLabResult>('v99_create_scenario', {
    scenario,
    test_dataset_tag: V99_SCENARIO_TAG,
  });
}

export async function cleanupScenarioLabDataset() {
  if (!isScenarioLabEnabled) {
    throw new Error('Scenario Lab cleanup is disabled outside local development or controlled pilot mode.');
  }
  return invokePrivilegedAction<ScenarioCleanupResult>('v99_cleanup_scenarios', {
    test_dataset_tag: V99_SCENARIO_TAG,
  });
}

export async function getScenarioLabStatus() {
  if (!isScenarioLabEnabled) {
    return {
      test_dataset_tag: V99_SCENARIO_TAG,
      total_records: 0,
      by_table: {},
      by_scenario: {},
    } satisfies ScenarioLabStatus;
  }
  return invokePrivilegedAction<ScenarioLabStatus>('v99_scenario_status', {
    test_dataset_tag: V99_SCENARIO_TAG,
  });
}
