import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canUploadOvrEvidence } from '../../src/pages/OVR';

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function section(input: string, startMarker: string, endMarker: string) {
  const start = input.indexOf(startMarker);
  const end = input.indexOf(endMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return input.slice(start, end);
}

const ovrPage = source('src/pages/OVR.tsx');
const controls = source('src/components/WorkItemControls.tsx');
const grcApi = source('src/lib/grcApi.ts');
const evidenceCenter = source('src/pages/Evidence.tsx');
const canCloseOvrMigration = source('supabase/migrations/036_b_ovr_workflow_controls.sql');

const authorizedAccess = {
  status: 'quality_final_review' as const,
  evidenceRequired: true,
  organizationMatches: true,
  roles: ['governance_admin'],
};

describe('OVR evidence-upload minimal hotfix R2', () => {
  it.each(['super_admin', 'governance_admin', 'compliance_officer'])(
    'allows the authorized %s role at quality_final_review',
    role => {
      expect(canUploadOvrEvidence({ ...authorizedAccess, roles: [role] })).toBe(true);
    },
  );

  it.each(['department_manager', 'employee', 'executive', 'auditor', 'viewer'])(
    'fails closed for the %s role',
    role => {
      expect(canUploadOvrEvidence({ ...authorizedAccess, roles: [role] })).toBe(false);
    },
  );

  it.each(['quality_final_review', 'evidence_submitted', 'quality_closure_review'] as const)(
    'allows evidence-relevant OVR status %s',
    status => {
      expect(canUploadOvrEvidence({ ...authorizedAccess, status })).toBe(true);
    },
  );

  it.each([
    'draft',
    'submitted',
    'manager_review',
    'quality_validation',
    'referred_party_response',
    'closed',
    'rejected',
    'cancelled',
  ] as const)('does not expose upload in %s', status => {
    expect(canUploadOvrEvidence({ ...authorizedAccess, status })).toBe(false);
  });

  it('requires both evidence relevance and active-organization alignment', () => {
    expect(canUploadOvrEvidence({ ...authorizedAccess, evidenceRequired: false })).toBe(false);
    expect(canUploadOvrEvidence({ ...authorizedAccess, organizationMatches: false })).toBe(false);
  });

  it('targets the selected OVR through the existing EvidenceUploadForm', () => {
    expect(controls).toContain("export type EvidenceUploadItemType =\n  | 'project'\n  | 'milestone'\n  | 'task'\n  | 'ovr_report';");
    expect(ovrPage).toContain('itemType="ovr_report"');
    expect(ovrPage).toContain('itemId={evidenceUploadReport.id}');
    expect(ovrPage).toContain('organizationId={organizationId}');
    expect(controls).toContain(
      'uploadEvidenceForItem({ organization_id: organizationId, item_type: itemType, item_id: itemId, file, description: description.trim() || undefined })',
    );
  });

  it('uses the private OVR evidence path and leaves evidence submitted', () => {
    const uploadApi = section(
      grcApi,
      'export async function uploadEvidenceForItem',
      'export interface RequestApprovalInput',
    );
    expect(grcApi).toContain("export type ApprovalItemType = 'project' | 'milestone' | 'task' | 'risk' | 'compliance_item' | 'audit_finding' | 'policy' | 'committee_decision' | 'ovr_report';");
    expect(grcApi).toContain("ovr_report: 'ovr_report_id'");
    expect(uploadApi).toContain(".from('grc-evidence')");
    expect(uploadApi).toContain("client.from('evidence_files').insert(payload)");
    expect(uploadApi).toContain("status: 'submitted'");
    expect(uploadApi).not.toMatch(/status:\s*'accepted'/);
  });

  it('leaves Evidence Center responsible for accepting submitted evidence', () => {
    expect(evidenceCenter).toContain('getEvidenceReviewQueue');
    expect(evidenceCenter).toContain('acceptEvidence({ evidence_file_id: evidenceId');
    expect(evidenceCenter).toContain("row.status === 'submitted' || row.status === 'needs_revision'");
  });

  it('allows OVR closure only after accepted OVR evidence exists', () => {
    expect(canCloseOvrMigration).toContain('where e.ovr_report_id = o.id');
    expect(canCloseOvrMigration).toContain("and e.status = 'accepted'");
  });

  it('does not transition the OVR or create a corrective project during upload', () => {
    const uploadFlow = section(
      ovrPage,
      'const openOvrEvidenceUpload = () => {',
      'const referredProfiles =',
    );
    expect(uploadFlow).not.toContain('updateOvrWorkflow');
    expect(uploadFlow).not.toContain('runWorkflowAction');
    expect(uploadFlow).not.toContain('createOvrCorrectiveActionProject');
  });

  it('closes the upload modal and refreshes all required OVR views after success', () => {
    const completion = section(
      ovrPage,
      'const completeOvrEvidenceUpload = () => {',
      'const referredProfiles =',
    );
    expect(completion).toContain('setEvidenceUploadReport(null)');
    expect(completion).toContain('reports.refresh()');
    expect(completion).toContain('workflowSummary.refresh()');
    expect(completion).toContain('workflowQueue.refresh()');
  });

  it('leaves project, milestone, and task status, approval, and upload behavior intact', () => {
    expect(controls).toContain("export type ControllableItemType = 'project' | 'milestone' | 'task';");
    expect(controls).toMatch(/interface StatusUpdateFormProps \{[\s\S]*itemType: ControllableItemType;/);
    expect(controls).toMatch(/interface ApprovalRequestFormProps \{[\s\S]*itemType: ControllableItemType;/);
    expect(controls).toMatch(/interface EvidenceUploadFormProps \{[\s\S]*itemType: EvidenceUploadItemType;/);
  });
});
