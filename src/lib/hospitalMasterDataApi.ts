import { supabase } from './supabase';
import { invokePrivilegedAction, throwRpcActionError } from './privilegedAction';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

type HospitalMasterPayload = Record<string, unknown>;

export interface HospitalMasterDataRow {
  id?: string;
  active?: boolean | null;
  created_at?: string | null;
  owner_name_en?: string | null;
  department_name_en?: string | null;
  [key: string]: unknown;
}

export interface MasterDataExceptionRow {
  item_type?: string | null;
  item_id?: string;
  item_code?: string | null;
  item_name?: string | null;
  active?: boolean | null;
  owner_user_id?: string | null;
  department_id?: string | null;
  exception_type?: string | null;
  [key: string]: unknown;
}

export interface OwnershipMappingRow {
  id?: string;
  owner_entity_type?: string | null;
  owner_entity_id?: string | null;
  owner_entity_name?: string | null;
  governed_entity_type?: string | null;
  governed_entity_id?: string | null;
  ownership_role?: string | null;
  active?: boolean | null;
  [key: string]: unknown;
}

async function selectPatch38View<T>(viewName: string, options: { order?: string; ascending?: boolean; limit?: number } = {}): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load live hospital master data.');
  }
  try {
    let query = supabase.from(viewName).select('*');
    if (options.order) query = query.order(options.order, { ascending: options.ascending ?? true });
    if (options.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error) return queryErrorResult<T[]>(error, `Unable to load ${viewName}.`);
    if (!data || data.length === 0) return emptyResult<T[]>(`No records returned from ${viewName}.`);
    return liveResult(data as T[], 'supabase');
  } catch (error) {
    return queryErrorResult<T[]>(error, `Unexpected error while loading ${viewName}.`);
  }
}

async function runMasterDataAction(action: string, rpcName: string, payload: HospitalMasterPayload) {
  try {
    return await invokePrivilegedAction(rpcName, payload);
  } catch (error) {
    return throwRpcActionError(error, action, rpcName);
  }
}

export function getHospitalLocationRegister(): Promise<LiveResult<HospitalMasterDataRow[]>> {
  return selectPatch38View<HospitalMasterDataRow>('v_patch38_hospital_location_register', { order: 'location_code', limit: 300 });
}
export function getHospitalServiceRegister(): Promise<LiveResult<HospitalMasterDataRow[]>> {
  return selectPatch38View<HospitalMasterDataRow>('v_patch38_hospital_service_register', { order: 'service_code', limit: 300 });
}
export function getClinicalAreaRegister(): Promise<LiveResult<HospitalMasterDataRow[]>> {
  return selectPatch38View<HospitalMasterDataRow>('v_patch38_clinical_area_register', { order: 'area_code', limit: 300 });
}
export function getCommitteeRegister(): Promise<LiveResult<HospitalMasterDataRow[]>> {
  return selectPatch38View<HospitalMasterDataRow>('v_patch38_committee_register', { order: 'committee_code', limit: 300 });
}
export function getJobTitleRegister(): Promise<LiveResult<HospitalMasterDataRow[]>> {
  return selectPatch38View<HospitalMasterDataRow>('v_patch38_job_title_register', { order: 'job_title_code', limit: 300 });
}
export function getQualityIndicatorRegister(): Promise<LiveResult<HospitalMasterDataRow[]>> {
  return selectPatch38View<HospitalMasterDataRow>('v_patch38_quality_indicator_register', { order: 'indicator_code', limit: 300 });
}
export function getMasterDataExceptionRegister(): Promise<LiveResult<MasterDataExceptionRow[]>> {
  return selectPatch38View<MasterDataExceptionRow>('v_patch38_master_data_exception_register', { order: 'item_type', limit: 300 });
}
export function getMasterDataOwnershipRegister(): Promise<LiveResult<OwnershipMappingRow[]>> {
  return selectPatch38View<OwnershipMappingRow>('v_patch38_master_data_ownership_register', { order: 'created_at', ascending: false, limit: 300 });
}

export function createHospitalLocation(payload: HospitalMasterPayload) { return runMasterDataAction('Create Hospital Location', 'create_hospital_location', payload); }
export function updateHospitalLocationStatus(payload: HospitalMasterPayload) { return runMasterDataAction('Update Hospital Location Status', 'update_hospital_location_status', payload); }
export function createHospitalService(payload: HospitalMasterPayload) { return runMasterDataAction('Create Hospital Service', 'create_hospital_service', payload); }
export function updateHospitalServiceStatus(payload: HospitalMasterPayload) { return runMasterDataAction('Update Hospital Service Status', 'update_hospital_service_status', payload); }
export function createHospitalClinicalArea(payload: HospitalMasterPayload) { return runMasterDataAction('Create Hospital Clinical Area', 'create_hospital_clinical_area', payload); }
export function updateHospitalClinicalAreaStatus(payload: HospitalMasterPayload) { return runMasterDataAction('Update Hospital Clinical Area Status', 'update_hospital_clinical_area_status', payload); }
export function createHospitalCommittee(payload: HospitalMasterPayload) { return runMasterDataAction('Create Hospital Committee', 'create_hospital_committee', payload); }
export function updateHospitalCommitteeStatus(payload: HospitalMasterPayload) { return runMasterDataAction('Update Hospital Committee Status', 'update_hospital_committee_status', payload); }
export function createHospitalJobTitle(payload: HospitalMasterPayload) { return runMasterDataAction('Create Hospital Job Title', 'create_hospital_job_title', payload); }
export function updateHospitalJobTitleStatus(payload: HospitalMasterPayload) { return runMasterDataAction('Update Hospital Job Title Status', 'update_hospital_job_title_status', payload); }
export function createHospitalQualityIndicator(payload: HospitalMasterPayload) { return runMasterDataAction('Create Hospital Quality Indicator', 'create_hospital_quality_indicator', payload); }
export function updateHospitalQualityIndicatorStatus(payload: HospitalMasterPayload) { return runMasterDataAction('Update Hospital Quality Indicator Status', 'update_hospital_quality_indicator_status', payload); }
export function createHospitalOwnershipMapping(payload: HospitalMasterPayload) { return runMasterDataAction('Create Hospital Ownership Mapping', 'create_hospital_ownership_mapping', payload); }
export function deactivateHospitalOwnershipMapping(payload: HospitalMasterPayload) { return runMasterDataAction('Deactivate Hospital Ownership Mapping', 'deactivate_hospital_ownership_mapping', payload); }
