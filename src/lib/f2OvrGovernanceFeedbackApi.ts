import { invokePrivilegedAction } from './privilegedAction';
import { requireSupabase } from './supabase';

export type F2OvrReviewOutcome = 'no_change' | 'minor_revision' | 'major_revision' | 'retire';

export interface F2OvrGovernanceFeedback {
  trigger_id: string;
  ovr_id: string;
  organization_id: string;
  document_link_id: string | null;
  document_id: string;
  document_type: 'policy' | 'sop';
  document_code: string | null;
  document_title: string;
  source_version_id: string;
  source_version_number: number;
  source_version_label: string | null;
  source_version_is_current: boolean;
  current_version_id: string | null;
  current_version_number: number | null;
  current_version_label: string | null;
  review_status: string;
  review_owner_id: string | null;
  due_date: string | null;
  outcome: F2OvrReviewOutcome | null;
  outcome_note: string | null;
  resulting_version_id: string | null;
  corrective_action_project_id: string | null;
  project_title: string | null;
  project_status: string | null;
  project_progress_percent: number | null;
  capa_link_id: string | null;
  capa_link_status: string | null;
  triggered_by: string | null;
  triggered_at: string;
  completed_at: string | null;
}

export async function getF2OvrGovernanceFeedback(
  ovrId: string,
): Promise<F2OvrGovernanceFeedback[]> {
  const { data, error } = await requireSupabase()
    .from('v_f2_ovr_governance_feedback')
    .select('*')
    .eq('ovr_id', ovrId)
    .order('triggered_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as F2OvrGovernanceFeedback[];
}

export async function initiateF2OvrGovernanceFeedbackReview(input: {
  ovrId: string;
  documentLinkId: string;
  dueDate: string;
  rationale: string;
}): Promise<unknown> {
  return invokePrivilegedAction('initiate_ovr_governance_feedback_review', {
    ovr_id: input.ovrId,
    document_link_id: input.documentLinkId,
    due_date: input.dueDate,
    rationale: input.rationale.trim(),
  });
}

export async function completeF2OvrGovernanceFeedbackReview(input: {
  triggerId: string;
  outcome: F2OvrReviewOutcome;
  outcomeNote: string;
}): Promise<unknown> {
  return invokePrivilegedAction('complete_ovr_governance_feedback_review', {
    trigger_id: input.triggerId,
    outcome: input.outcome,
    outcome_note: input.outcomeNote.trim(),
  });
}

export async function syncF2OvrCorrectiveActionCapaLink(ovrId: string): Promise<unknown> {
  return invokePrivilegedAction('sync_ovr_corrective_action_capa_link', { ovr_id: ovrId });
}
