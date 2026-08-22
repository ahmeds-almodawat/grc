import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const projects = source('src/pages/ProjectPortfolioCenter.tsx');
const evidence = source('src/pages/EvidenceCenter.tsx');
const legacyProject = source('src/components/ProjectDetail.tsx');
const legacyEvidence = source('src/pages/Evidence.tsx');
const api = source('src/lib/grcApi.ts');
const fixtures = source('tests/e2e/ui6Fixtures.ts');
const css = source('src/styles/ui6-projects-evidence.css');

describe('UI-6 Projects and Evidence governed workspaces', () => {
  it('publishes the locked ten-view Projects and Evidence families', () => {
    for (const view of ['overview', 'register', 'programs', 'timeline', 'resources', 'reports', 'risks', 'benefits', 'analytics', 'approval']) {
      expect(projects).toContain(`id: '${view}'`);
    }
    for (const view of ['overview', 'repository', 'status', 'categories', 'retention', 'requests', 'collections', 'storage', 'actions', 'search']) {
      expect(evidence).toContain(`id: '${view}'`);
    }
  });

  it('reuses the canonical project hierarchy, stored progress, delay reason and dashboard Gantt', () => {
    expect(projects).toContain('getProjects()');
    expect(projects).toContain('getPortfolioMilestones()');
    expect(projects).toContain('getPortfolioTasks()');
    expect(projects).toContain('project.progress_percent');
    expect(projects).toContain('project.delay_reason');
    expect(projects).toContain('<PortfolioGantt');
    expect(projects).toContain('Open governed controls');
    expect(legacyProject).toContain('StatusUpdateForm');
    expect(legacyProject).toContain('EvidenceUploadForm');
  });

  it('keeps Program presentation as a supported grouping instead of inventing a duplicate entity', () => {
    expect(projects).toContain("const key = project.category || 'general'");
    expect(projects).toContain('no duplicate Program entity is created');
    expect(projects).toContain('No canonical benefits register is configured');
  });

  it('preserves structured source lineage including direct and CAPA-linked projects', () => {
    expect(projects).toContain('source_reference_id');
    expect(projects).toContain('getProjectCapaLinks');
    expect(api).toContain(".from('v_patch28_capa_link_index')");
    expect(api).toContain(".eq('linked_item_type', 'project')");
    expect(projects).toContain("sourceRoute(row.type)");
    expect(fixtures).toContain('CAPA-0042 Corrective Action Delivery');
    expect(fixtures).toContain('Internal Audit Finding Remediation');
    expect(fixtures).toContain('Medication Safety Control Hardening');
  });

  it('keeps evidence upload, review, private access and history on existing governed paths', () => {
    expect(evidence).toContain('EvidenceUploadForm');
    expect(evidence).toContain('EvidenceGovernanceConsole');
    expect(evidence).toContain('GovernedEvidenceAccess');
    expect(evidence).toContain('does not silently overwrite');
    expect(legacyEvidence).toContain('requestEvidenceRevision');
    expect(legacyEvidence).toContain('supersedeEvidence');
    expect(legacyEvidence).toContain('getEvidenceChainOfCustody');
  });

  it('distinguishes uploaded, reviewed, accepted, rejected, restricted and validity states', () => {
    for (const marker of ['Uploaded is not verified', 'pending_review', 'accepted', 'rejected', 'restricted', 'expiryDate']) {
      expect(evidence).toContain(marker);
    }
    expect(evidence).toContain('No expiry is invented');
    expect(evidence).toContain('Seeing this relationship does not grant access');
  });

  it('supports one evidence file reused by multiple governed sources without duplicate storage', () => {
    expect(evidence).toContain('Multi-source reuse');
    expect(evidence).toContain('links.length > 1');
    expect(fixtures.match(/\['evidence-ui6-1'/g)?.length).toBe(3);
    expect(fixtures).toContain("['evidence-ui6-8', 'project'");
    expect(fixtures).toContain("['evidence-ui6-8', 'milestone'");
    expect(fixtures).toContain("['evidence-ui6-8', 'task'");
    expect(fixtures).toContain("['evidence-ui6-6', 'training'");
    expect(evidence).toContain("return 'trainingGovernance'");
  });

  it('keeps visual fixtures test-only and runtime source free of fixture imports', () => {
    expect(fixtures).toContain('export const ui6Projects');
    expect(fixtures).toContain('Restricted Patient Safety Investigation');
    expect(projects).not.toContain('ui6Projects');
    expect(evidence).not.toContain('ui6Evidence');
  });

  it('uses semantic tokens, logical RTL properties, mobile rules, and no migration 215', () => {
    expect(projects).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(evidence).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(css).toContain('var(--platform-surface-primary)');
    expect(css).toContain('padding-inline');
    expect(css).toContain('border-inline');
    expect(css).toContain('@media (max-width: 560px)');
    expect(css).not.toMatch(/letter-spacing:\s*-/);
    expect(fs.existsSync(path.join(root, 'supabase/migrations/215_ui6_projects_evidence.sql'))).toBe(false);
  });
});
