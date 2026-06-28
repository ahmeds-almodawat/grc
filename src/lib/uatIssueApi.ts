import { requireSupabase } from './supabase';

export type UatIssueSeverity = 'low' | 'medium' | 'high' | 'blocker';
export type UatIssueStatus = 'open' | 'reviewing' | 'fixed' | 'deferred';

export interface UatIssueInput {
  title: string;
  module: string;
  roleAccountUsed: string;
  stepsToReproduce: string;
  expectedResult: string;
  actualResult: string;
  screenshotAvailable?: boolean;
  screenshotNote?: string;
  ownerName?: string;
  severity: UatIssueSeverity;
  status: UatIssueStatus;
}

export interface UatIssueRow {
  id: string;
  issue_code: string | null;
  title: string;
  module: string | null;
  role_account_used: string | null;
  steps_to_reproduce: string | null;
  expected_result: string | null;
  actual_result: string | null;
  screenshot_note: string | null;
  owner_name: string | null;
  severity: UatIssueSeverity | 'critical';
  status: UatIssueStatus | 'triaged' | 'in_progress' | 'blocked' | 'resolved' | 'accepted_risk' | 'closed';
  created_at: string;
}

function buildDescription(input: UatIssueInput) {
  const screenshotStatus = input.screenshotAvailable ? 'Yes' : 'No';
  return [
    `Module: ${input.module}`,
    `Role/account used: ${input.roleAccountUsed}`,
    `Owner: ${input.ownerName?.trim() || 'Unassigned'}`,
    '',
    'Steps to reproduce:',
    input.stepsToReproduce,
    '',
    'Expected result:',
    input.expectedResult,
    '',
    'Actual result:',
    input.actualResult,
    '',
    `Screenshot available: ${screenshotStatus}`,
    'Screenshot note:',
    input.screenshotNote?.trim() || 'No screenshot note provided.',
    '',
    'Controlled pilot boundary: synthetic/non-confidential UAT issue only.',
  ].join('\n');
}

function buildScreenshotNote(input: UatIssueInput) {
  return [
    `Screenshot available: ${input.screenshotAvailable ? 'Yes' : 'No'}`,
    input.screenshotNote?.trim() ? `Note: ${input.screenshotNote.trim()}` : 'Note: No screenshot note provided.',
  ].join('\n');
}

export async function createUatIssue(input: UatIssueInput) {
  const supabase = requireSupabase();
  const payload = {
    title: input.title.trim(),
    issue_code: `UAT-${Date.now()}`,
    module: input.module.trim(),
    role_account_used: input.roleAccountUsed.trim(),
    steps_to_reproduce: input.stepsToReproduce.trim(),
    expected_result: input.expectedResult.trim(),
    actual_result: input.actualResult.trim(),
    screenshot_note: buildScreenshotNote(input),
    owner_name: input.ownerName?.trim() || null,
    severity: input.severity,
    status: input.status,
    description: buildDescription(input),
  };
  const { data, error } = await supabase
    .from('controlled_pilot_issues')
    .insert(payload)
    .select('id,issue_code,title,module,role_account_used,steps_to_reproduce,expected_result,actual_result,screenshot_note,owner_name,severity,status,created_at')
    .single();
  if (error) throw error;
  return data as UatIssueRow;
}

export async function listRecentUatIssues() {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('controlled_pilot_issues')
    .select('id,issue_code,title,module,role_account_used,steps_to_reproduce,expected_result,actual_result,screenshot_note,owner_name,severity,status,created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data || []) as UatIssueRow[];
}
