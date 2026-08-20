import { invokePrivilegedAction } from './privilegedAction';
import { requireSupabase } from './supabase';

export interface F1OvrGovernedVersionLink {
  link_id: string;
  ovr_id: string;
  organization_id: string;
  document_id: string;
  document_type: 'policy' | 'sop';
  document_code: string | null;
  document_title: string;
  version_id: string;
  version_number: number;
  version_label: string | null;
  approved_at: string;
  approved_by: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  locked_at: string;
  is_current_version: boolean;
  superseded_by_version_id: string | null;
  created_by: string | null;
  created_at: string;
  is_historical_version: boolean;
}

export interface F1LinkableGovernedVersion {
  organization_id: string;
  document_id: string;
  document_type: 'policy' | 'sop';
  document_code: string | null;
  document_title: string;
  version_id: string;
  version_number: number;
  version_label: string | null;
  approved_at: string;
  approved_by: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  locked_at: string;
  is_current_version: boolean;
  superseded_by_version_id: string | null;
  is_historical_version: boolean;
}

export async function getF1OvrGovernedVersionLinks(
  ovrId: string,
): Promise<F1OvrGovernedVersionLink[]> {
  const { data, error } = await requireSupabase()
    .from('v_f1_ovr_governed_version_links')
    .select('*')
    .eq('ovr_id', ovrId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as F1OvrGovernedVersionLink[];
}

export async function getF1LinkableGovernedVersions(): Promise<F1LinkableGovernedVersion[]> {
  const { data, error } = await requireSupabase()
    .from('v_f1_linkable_governed_document_versions')
    .select('*')
    .order('document_code', { ascending: true })
    .order('version_number', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as F1LinkableGovernedVersion[];
}

export async function linkF1OvrGovernedVersion(input: {
  ovrId: string;
  versionId: string;
  note?: string;
}): Promise<unknown> {
  return invokePrivilegedAction('link_ovr_governed_document_version', {
    ovr_id: input.ovrId,
    version_id: input.versionId,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  });
}

export async function unlinkF1OvrGovernedVersion(input: {
  linkId: string;
  reason: string;
}): Promise<unknown> {
  return invokePrivilegedAction('unlink_ovr_governed_document_version', {
    link_id: input.linkId,
    reason: input.reason.trim(),
  });
}
