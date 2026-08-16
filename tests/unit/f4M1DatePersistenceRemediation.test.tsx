import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MilestoneForm } from '../../src/components/GrcForms';

const apiMocks = vi.hoisted(() => ({
  createMilestone: vi.fn(),
  searchEligibleWorkParticipants: vi.fn(async () => []),
}));

vi.mock('../../src/lib/grcApi', () => ({
  createAuditFinding: vi.fn(),
  createComplianceItem: vi.fn(),
  createGovernanceDecision: vi.fn(),
  createMilestone: apiMocks.createMilestone,
  createRisk: vi.fn(),
  createTask: vi.fn(),
  searchEligibleWorkParticipants: apiMocks.searchEligibleWorkParticipants,
}));

vi.mock('../../src/components/ScenarioFillButton', () => ({ ScenarioFillButton: () => null }));
vi.mock('../../src/lib/scenarioLab', () => ({
  createScenarioLabScenario: vi.fn(),
  V99_SCENARIO_TAG: 'V99_SCENARIO',
}));

const root = resolve(import.meta.dirname, '../..');
const readSource = (path: string) => readFileSync(resolve(root, path), 'utf8');
const renderForm = () => render(
  <MilestoneForm
    organizationId="org-f4"
    projectId="project-f4"
    onCreated={vi.fn()}
    onCancel={vi.fn()}
  />,
);
const setDomDate = (label: RegExp, value: string) => {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  input.value = value;
  return input;
};
const submitForm = () => {
  const form = screen.getByRole('button', { name: 'Add Milestone' }).closest('form');
  if (!form) throw new Error('Milestone form not found');
  fireEvent.submit(form);
};

describe('F4 M1 milestone date persistence remediation', () => {
  beforeEach(() => {
    apiMocks.createMilestone.mockReset();
    apiMocks.createMilestone.mockResolvedValue({ id: 'm1', title: 'M1' });
    apiMocks.searchEligibleWorkParticipants.mockClear();
  });

  afterEach(() => cleanup());

  it('preserves exact DOM-entered dates across an unrelated controlled-field rerender', () => {
    renderForm();
    const start = setDomDate(/Start date/, '2026-08-16');
    const due = setDomDate(/Due date/, '2026-08-22');

    fireEvent.change(screen.getByLabelText(/Milestone title/), { target: { value: 'F4 M1' } });

    expect(start.value).toBe('2026-08-16');
    expect(due.value).toBe('2026-08-22');
  });

  it('submits both authoritative form dates unchanged to createMilestone', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Milestone title/), { target: { value: 'F4 M2' } });
    setDomDate(/Start date/, '2026-08-16');
    setDomDate(/Due date/, '2026-08-22');
    submitForm();

    await waitFor(() => expect(apiMocks.createMilestone).toHaveBeenCalledTimes(1));
    expect(apiMocks.createMilestone).toHaveBeenCalledWith(expect.objectContaining({
      start_date: '2026-08-16',
      due_date: '2026-08-22',
    }));
  });

  it.each([
    ['', ''],
    ['2026-08-16', ''],
    ['', '2026-08-22'],
  ])('fails before mutation when milestone dates are missing or partial (%s / %s)', async (start, due) => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Milestone title/), { target: { value: 'Incomplete milestone' } });
    setDomDate(/Start date/, start);
    setDomDate(/Due date/, due);
    submitForm();

    expect(await screen.findByText('Milestone start and due dates are required.')).toBeTruthy();
    expect(apiMocks.createMilestone).not.toHaveBeenCalled();
  });

  it('continues to reject inverted milestone dates before mutation', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Milestone title/), { target: { value: 'Inverted milestone' } });
    setDomDate(/Start date/, '2026-08-22');
    setDomDate(/Due date/, '2026-08-16');
    submitForm();

    expect(await screen.findByText('Milestone due date cannot precede its start date.')).toBeTruthy();
    expect(apiMocks.createMilestone).not.toHaveBeenCalled();
  });

  it('keeps the Edge payload unchanged and the RPC mandatory-date/audit contract exact', () => {
    const edge = readSource('supabase/functions/privileged-action/index.ts');
    const migration = readSource('supabase/migrations/197_f4_milestone_date_persistence_guard.sql');
    const edgeBranch = edge.slice(
      edge.indexOf("if (action === 'f1r2_create_work_item')"),
      edge.indexOf("} else if (action === 'f1r2_create_ovr_report'"),
    );

    expect(edgeBranch).toContain('p_payload: payload');
    expect(migration).toContain("if v_start is null or v_due is null then raise exception 'F1R2_MILESTONE_DATES_REQUIRED'");
    expect(migration).toContain("raise exception 'F1R2_MILESTONE_DATES_REQUIRED'");
    expect(migration).toContain("values(v_actor.organization_id,v_project.id,v_title,nullif(btrim(p_payload->>'description'),''),null,v_start,v_due,'not_started'");
    expect(migration).toContain("jsonb_build_object('start_date',v_start,'due_date',v_due,'assignment',v_result)");
    expect(migration).toContain("v_due<v_start then raise exception 'F1R2_INVALID_DATE_ORDER'");
  });
});
