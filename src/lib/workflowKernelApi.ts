import { supabase } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

export type WorkflowKernelSummary = {
  organization_id: string;
  workflow_count: number;
  active_workflow_count: number;
  overdue_workflow_count: number;
  open_assignment_count: number;
  open_escalation_count: number;
  evidence_attention_count: number;
  module_count: number;
};

export type WorkflowKernelQueueRow = {
  organization_id: string;
  workflow_id: string;
  module_key: string;
  source_type: string;
  source_code: string | null;
  workflow_title: string;
  workflow_status: string;
  priority: 'critical' | 'high' | 'normal' | 'low' | string;
  owner_name: string | null;
  workflow_due_date: string | null;
  assignment_id: string | null;
  assignee_name: string | null;
  assignment_role: string | null;
  assignment_status: string | null;
  assignment_due_date: string | null;
  queue_signal: 'overdue' | 'due_soon' | 'high_priority' | 'normal' | string;
};

export type WorkflowKernelSlaRow = {
  organization_id: string;
  module_key: string;
  workflow_status: string;
  workflow_count: number;
  overdue_count: number;
  due_soon_count: number;
  nearest_due_date: string | null;
};

export type WorkflowKernelModuleCoverageRow = {
  organization_id: string;
  module_key: string;
  template_count: number;
  step_count: number;
  instance_count: number;
  active_instance_count: number;
};

async function selectView<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load workflow kernel data.',
    );
  }

  try {
    let query = supabase.from(viewName).select('*');

    if (options.order) {
      query = query.order(options.order, { ascending: options.ascending ?? true });
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return queryErrorResult<T[]>(error, `Unable to load ${viewName}.`);
    }

    if (!data || data.length === 0) {
      return emptyResult<T[]>(`No records returned from ${viewName}.`);
    }

    return liveResult(data as T[], 'supabase');
  } catch (error) {
    return queryErrorResult<T[]>(error, `Unexpected error while loading ${viewName}.`);
  }
}

export async function getWorkflowKernelSummary(): Promise<LiveResult<WorkflowKernelSummary>> {
  const result = await selectView<WorkflowKernelSummary>('v_workflow_kernel_summary', { limit: 1 });

  if (result.status !== 'live') {
    return result as unknown as LiveResult<WorkflowKernelSummary>;
  }

  const first = result.data[0];
  return first ? liveResult(first, 'supabase') : emptyResult<WorkflowKernelSummary>('No workflow kernel summary row returned.');
}

export function getWorkflowKernelQueue(): Promise<LiveResult<WorkflowKernelQueueRow[]>> {
  return selectView<WorkflowKernelQueueRow>('v_workflow_kernel_queue', {
    order: 'assignment_due_date',
    ascending: true,
    limit: 150,
  });
}

export function getWorkflowKernelSlaDashboard(): Promise<LiveResult<WorkflowKernelSlaRow[]>> {
  return selectView<WorkflowKernelSlaRow>('v_workflow_kernel_sla_dashboard', {
    order: 'nearest_due_date',
    ascending: true,
    limit: 150,
  });
}

export function getWorkflowKernelModuleCoverage(): Promise<LiveResult<WorkflowKernelModuleCoverageRow[]>> {
  return selectView<WorkflowKernelModuleCoverageRow>('v_workflow_kernel_module_coverage', {
    order: 'module_key',
    ascending: true,
    limit: 150,
  });
}
