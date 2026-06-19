import { supabase } from './supabaseClient';
import { emptyLiveObject } from './liveData';

export type V50Status = 'not_started' | 'in_progress' | 'passed' | 'warning' | 'blocked' | 'waived';

export type V50ScaleScorecard = {
  total_controls: number;
  passed_controls: number;
  blocked_controls: number;
  warning_controls: number;
  readiness_percent: number;
};

export type V50BackupScorecard = {
  backup_controls: number;
  backup_passed: number;
  backup_blocked: number;
  backup_runs_last_7_days: number;
  restore_dryruns_passed: number;
  restore_dryruns_with_issues: number;
};

export type V50QueueItem = {
  id: string;
  object_name?: string;
  object_type?: string;
  page_or_module?: string;
  risk_reason?: string;
  recommendation?: string;
  priority?: string;
  status: V50Status;
  owner_name?: string | null;
};

const liveEmptyScale: V50ScaleScorecard = emptyLiveObject<V50ScaleScorecard>('liveEmptyScale');

const liveEmptyBackup: V50BackupScorecard = emptyLiveObject<V50BackupScorecard>('liveEmptyBackup');

async function safeOne<T>(query: any, emptyRows: T): Promise<T> {
  try {
    const { data, error } = await query;
    if (error || !data) return emptyRows;
    return Array.isArray(data) ? (data[0] ?? emptyRows) : data;
  } catch {
    return emptyRows;
  }
}

async function safeList<T>(query: any, emptyRows: T[]): Promise<T[]> {
  try {
    const { data, error } = await query;
    if (error || !data) return emptyRows;
    return data as T[];
  } catch {
    return emptyRows;
  }
}

export async function getV50ScaleScorecard() {
  return safeOne<V50ScaleScorecard>(supabase.from('v_v50_scale_readiness_scorecard').select('*').limit(1).maybeSingle(), liveEmptyScale);
}

export async function getV50BackupScorecard() {
  return safeOne<V50BackupScorecard>(supabase.from('v_v50_backup_restore_scorecard').select('*').limit(1).maybeSingle(), liveEmptyBackup);
}

export async function getV50OptimizationQueue() {
  return safeList<V50QueueItem>(supabase.from('v_v50_query_optimization_queue').select('*').limit(50), []);
}

export async function getV50RestoreQueue() {
  return safeList<any>(supabase.from('v_v50_restore_dryrun_queue').select('*').limit(50), []);
}
