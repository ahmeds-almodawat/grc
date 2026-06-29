import { supabase } from './supabase';
import { emptyLiveArray } from './liveData';

export type SetupReadinessRow = {
  check_key: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  area: 'organization' | 'users' | 'workflow' | 'risk' | 'ovr' | 'backup' | 'reports';
  severity: 'good' | 'warning' | 'critical';
  current_count: number;
  target_count: number;
  is_complete: boolean;
  action_hint_en: string;
  action_hint_ar: string;
};

export type TrainingChecklistRow = {
  id: string;
  audience: 'executive' | 'governance' | 'department_manager' | 'quality' | 'auditor' | 'employee';
  title_en: string;
  title_ar: string;
  objective_en: string;
  objective_ar: string;
  estimated_minutes: number;
  sort_order: number;
};

const liveEmptyReadiness: SetupReadinessRow[] = emptyLiveArray<SetupReadinessRow>();

const liveEmptyTraining: TrainingChecklistRow[] = emptyLiveArray<TrainingChecklistRow>();

function logFallback(label: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.warn(`[GRC demo emptyRows] ${label}`, error);
}

export async function getSetupReadiness(): Promise<SetupReadinessRow[]> {
  if (!supabase) return emptyLiveArray<any>();
  try {
    const { data, error } = await supabase
      .from('v_setup_readiness_checklist')
      .select('*')
      .order('area', { ascending: true })
      .order('severity', { ascending: true });
    if (error) throw error;
    return (data as SetupReadinessRow[])?.length ? (data as SetupReadinessRow[]) : liveEmptyReadiness;
  } catch (error) {
    logFallback('setup readiness', error);
    return emptyLiveArray<any>();
  }
}

export async function getTrainingChecklist(): Promise<TrainingChecklistRow[]> {
  if (!supabase) return emptyLiveArray<any>();
  try {
    const { data, error } = await supabase
      .from('grc_training_checklist')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data as TrainingChecklistRow[])?.length ? (data as TrainingChecklistRow[]) : liveEmptyTraining;
  } catch (error) {
    logFallback('training checklist', error);
    return emptyLiveArray<any>();
  }
}
