import { supabase } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

export type RuntimeWorkflowActionSummary = {
  organization_id: string;
  action_request_count: number;
  active_request_count: number;
  high_priority_request_count: number;
  open_exception_count: number;
  pending_outbox_count: number;
  active_bulk_operation_count: number;
};

export type RuntimeWorkflowActionQueueRow = {
  organization_id: string;
  action_request_id: string;
  source_module: string;
  source_type: string;
  requested_action: string;
  request_status: string;
  priority: string;
  requester_name: string | null;
  assigned_reviewer_name: string | null;
  due_at: string | null;
  queue_signal: string;
};

export type RuntimeWorkflowNotificationOutboxRow = {
  organization_id: string;
  outbox_id: string;
  event_code: string;
  event_type: string;
  source_module: string;
  target_system: string;
  delivery_status: string;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
  queue_signal: string;
};

export type RuntimeWorkflowExceptionRow = {
  organization_id: string;
  exception_code: string;
  source_module: string;
  exception_type: string;
  severity: string;
  exception_status: string;
  owner_name: string | null;
  due_date: string | null;
  queue_signal: string;
};

async function selectView<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load runtime workflow action data.',
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

export async function getRuntimeWorkflowActionSummary(): Promise<LiveResult<RuntimeWorkflowActionSummary>> {
  const result = await selectView<RuntimeWorkflowActionSummary>('v_runtime_workflow_action_summary', { limit: 1 });

  if (result.status !== 'live') {
    return result as unknown as LiveResult<RuntimeWorkflowActionSummary>;
  }

  const first = result.data[0];
  return first ? liveResult(first, 'supabase') : emptyResult<RuntimeWorkflowActionSummary>('No runtime workflow action summary row returned.');
}

export function getRuntimeWorkflowActionQueue(): Promise<LiveResult<RuntimeWorkflowActionQueueRow[]>> {
  return selectView<RuntimeWorkflowActionQueueRow>('v_runtime_workflow_action_queue', {
    order: 'due_at',
    ascending: true,
    limit: 150,
  });
}

export function getRuntimeWorkflowNotificationOutbox(): Promise<LiveResult<RuntimeWorkflowNotificationOutboxRow[]>> {
  return selectView<RuntimeWorkflowNotificationOutboxRow>('v_runtime_workflow_notification_outbox', {
    order: 'created_at',
    ascending: true,
    limit: 150,
  });
}

export function getRuntimeWorkflowExceptionDashboard(): Promise<LiveResult<RuntimeWorkflowExceptionRow[]>> {
  return selectView<RuntimeWorkflowExceptionRow>('v_runtime_workflow_exception_dashboard', {
    order: 'due_date',
    ascending: true,
    limit: 150,
  });
}
