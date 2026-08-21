import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { GovernedDecisionDialog } from '../components/GovernedDecisionDialog';
import { RiskForm } from '../components/GrcForms';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { departmentName, formatDate, humanize, ownerName } from '../lib/format';
import {
  approveRiskAcceptance,
  approveRiskClosure,
  completeRiskTreatment,
  getDepartments,
  getExecutiveRiskEscalations,
  getOrganizations,
  getProfiles,
  getRiskAppetiteBreaches,
  getRiskClosureBlockers,
  getRiskKriAlerts,
  getRiskReassessmentHistory,
  getRiskTreatmentQueue,
  getRiskWorkflowEvents,
  getRiskWorkflowQueue,
  getRisks,
  linkRiskSource,
  markDuplicateRisk,
  rejectRiskAcceptance,
  reopenRiskWithReason,
  requestRiskAcceptance,
  requestRiskClosure,
  updateRiskAssessment,
  updateRiskTreatment,
} from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import type { RiskReassessmentHistoryRow, RiskRow, RiskWorkflowEventRow } from '../types/domain';

type RiskActionType =
  | 'reassess'
  | 'request_acceptance'
  | 'update_treatment'
  | 'link_source'
  | 'mark_duplicate'
  | 'request_closure'
  | 'reopen';

interface RiskDecisionState {
  action: RiskActionType;
  risk: RiskRow;
}

export function Risks() {
  const auth = useAuth();
  const { language, t } = useI18n();
  const [formOpen, setFormOpen] = useState(false);
  const [riskFormDirty, setRiskFormDirty] = useState(false);
  const [riskFormSubmitting, setRiskFormSubmitting] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<RiskRow | null>(null);
  const [decisionDialog, setDecisionDialog] = useState<RiskDecisionState | null>(null);
  const [riskHistory, setRiskHistory] = useState<RiskReassessmentHistoryRow[]>([]);
  const [riskEvents, setRiskEvents] = useState<RiskWorkflowEventRow[]>([]);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const risks = useAsyncData(getRisks, []);
  const workflowQueue = useAsyncData(getRiskWorkflowQueue, []);
  const appetiteBreaches = useAsyncData(getRiskAppetiteBreaches, []);
  const treatmentQueue = useAsyncData(getRiskTreatmentQueue, []);
  const kriAlerts = useAsyncData(getRiskKriAlerts, []);
  const executiveEscalations = useAsyncData(getExecutiveRiskEscalations, []);
  const closureBlockers = useAsyncData(getRiskClosureBlockers, []);
  const departments = useAsyncData(getDepartments, []);
  const profiles = useAsyncData(getProfiles, []);
  const organizations = useAsyncData(getOrganizations, []);
  const organizationId = organizations.data?.[0]?.id || '';  const canManageRisks = auth.roles.some(
    role => ['super_admin', 'governance_admin', 'division_head', 'department_manager', 'compliance_officer'].includes(role.role)
  );
  const riskRows = risks.data || [];
  const queueRows = workflowQueue.data || [];
  const breachRows = appetiteBreaches.data || [];
  const treatmentRows = treatmentQueue.data || [];
  const kriRows = kriAlerts.data || [];
  const escalationRows = executiveEscalations.data || [];
  const blockerRows = closureBlockers.data || [];
  const selectedBlocker = selectedRisk ? blockerRows.find(row => row.risk_id === selectedRisk.id) : null;
  const selectedQueueRows = selectedRisk ? queueRows.filter(row => row.risk_id === selectedRisk.id) : [];
  const selectedWarnings = useMemo(() => {
    if (!selectedRisk) return [];
    return [
      selectedRisk.appetite_breached ? t('risks.g.aboveAppetite', 'Above appetite') : '',
      selectedRisk.treatment_required && selectedRisk.treatment_status !== 'completed' ? t('risks.treatmentRequired', 'Treatment required') : '',
      selectedRisk.review_overdue ? t('risks.g.reviewOverdue', 'Review overdue') : '',
      selectedBlocker?.blocker_reason ? `${t('risks.g.closureBlocked', 'Closure blocked')}: ${selectedBlocker.blocker_reason}` : '',
      selectedRisk.escalation_required ? t('risks.g.escalationRequired', 'Executive or management escalation required') : '',
    ].filter(Boolean);
  }, [selectedBlocker?.blocker_reason, selectedRisk, t]);

  async function refreshRiskWorkflow() {
    await Promise.all([
      risks.refresh(),
      workflowQueue.refresh(),
      appetiteBreaches.refresh(),
      treatmentQueue.refresh(),
      kriAlerts.refresh(),
      executiveEscalations.refresh(),
      closureBlockers.refresh(),
    ]);
    if (selectedRisk) {
      const [history, events] = await Promise.all([
        getRiskReassessmentHistory(selectedRisk.id),
        getRiskWorkflowEvents(selectedRisk.id),
      ]);
      setRiskHistory(history);
      setRiskEvents(events);
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!selectedRisk) {
      setRiskHistory([]);
      setRiskEvents([]);
      return;
    }
    Promise.all([
      getRiskReassessmentHistory(selectedRisk.id),
      getRiskWorkflowEvents(selectedRisk.id),
    ]).then(([history, events]) => {
      if (!cancelled) {
        setRiskHistory(history);
        setRiskEvents(events);
      }
    }).catch(error => {
      if (!cancelled) setWorkflowMessage(error instanceof Error ? error.message : t('risks.g.historyLoadError', 'Unable to load risk workflow history.'));
    });
    return () => { cancelled = true; };
  }, [selectedRisk, t]);

  async function runRiskAction(label: string, action: () => Promise<unknown>) {
    setWorkflowBusy(true);
    setWorkflowMessage(null);
    try {
      await action();
      setWorkflowMessage(`${label} saved.`);
      await refreshRiskWorkflow();
    } catch (error) {
      setWorkflowMessage(error instanceof Error ? error.message : `${label} failed.`);
    } finally {
      setWorkflowBusy(false);
    }
  }

  function defaultExpiryDate() {
    const date = new Date();
    date.setDate(date.getDate() + 90);
    return date.toISOString().slice(0, 10);
  }

  async function executeRiskDecision(values: Record<string, any>) {
    if (!decisionDialog) return;
    const { action, risk } = decisionDialog;
    setWorkflowBusy(true);
    setWorkflowMessage(null);

    try {
      if (action === 'reassess') {
        const likelihood = Number(values.residual_likelihood);
        const impact = Number(values.residual_impact);
        const reason = values.change_reason?.trim();
        await updateRiskAssessment({
          risk_id: risk.id,
          likelihood: risk.likelihood,
          impact: risk.impact,
          residual_likelihood: likelihood,
          residual_impact: impact,
          appetite_threshold: risk.appetite_threshold ?? 12,
          change_reason: reason,
        });
        setWorkflowMessage('Risk reassessment saved.');
      } else if (action === 'request_acceptance') {
        await requestRiskAcceptance({
          risk_id: risk.id,
          reason: values.reason,
          acceptance_expiry_date: values.acceptance_expiry_date,
        });
        setWorkflowMessage('Risk acceptance request saved.');
      } else if (action === 'update_treatment') {
        await updateRiskTreatment({
          risk_id: risk.id,
          treatment_status: 'planned',
          treatment_plan_summary: values.treatment_plan_summary,
          treatment_due_date: values.treatment_due_date || undefined,
          treatment_owner_id: risk.treatment_owner_id || risk.owner_id || undefined,
          note: values.treatment_plan_summary,
        });
        setWorkflowMessage('Risk treatment saved.');
      } else if (action === 'link_source') {
        await linkRiskSource({
          risk_id: risk.id,
          source_ovr_id: values.source_ovr_id || undefined,
          source_audit_finding_id: values.source_audit_finding_id || undefined,
          source_compliance_id: values.source_compliance_id || undefined,
          source_project_id: values.source_project_id || undefined,
          note: 'Source linkage updated',
        });
        setWorkflowMessage('Risk source link saved.');
      } else if (action === 'mark_duplicate') {
        await markDuplicateRisk({
          risk_id: risk.id,
          duplicate_of_risk_id: values.duplicate_of_risk_id,
          reason: values.reason || undefined,
        });
        setWorkflowMessage('Duplicate risk signal saved.');
      } else if (action === 'request_closure') {
        await requestRiskClosure({
          risk_id: risk.id,
          reason: values.reason || undefined,
        });
        setWorkflowMessage('Closure request saved.');
      } else if (action === 'reopen') {
        await reopenRiskWithReason({
          risk_id: risk.id,
          reason: values.reason || undefined,
        });
        setWorkflowMessage('Risk reopen saved.');
      }
      await refreshRiskWorkflow();
    } finally {
      setWorkflowBusy(false);
    }
  }

  const openRiskForm = () => {
    setRiskFormDirty(false);
    setRiskFormSubmitting(false);
    setFormOpen(true);
  };

  const closeRiskForm = () => {
    setFormOpen(false);
    setRiskFormDirty(false);
    setRiskFormSubmitting(false);
  };

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow={t('risks.eyebrow')}
        title={t('risks.title')}
        subtitle={t('risks.subtitle')}
        action={(
          <div className="inline-actions">
            {canManageRisks ? <button className="primary-button" onClick={openRiskForm}>{t('risks.new')}</button> : null}
          </div>
        )}
      />
      {workflowMessage ? <div className="notice-banner">{workflowMessage}</div> : null}

      <div className="module-grid">
        <div className="module-card"><strong>{t('risks.total')}</strong><span>{riskRows.length} {t('risks.totalHint')}</span></div>
        <div className="module-card danger"><strong>{t('risks.criticalHigh')}</strong><span>{riskRows.filter(r => r.risk_level === 'critical' || r.risk_level === 'high').length} {t('risks.criticalHighHint')}</span></div>
        <div className="module-card warning"><strong>{t('risks.treatmentRequired')}</strong><span>{treatmentRows.length} {t('risks.treatmentQueued')}</span></div>
        <div className="module-card danger"><strong>{t('risks.appetiteBreached')}</strong><span>{breachRows.length} {t('risks.breachedHint')}</span></div>
        <div className="module-card warning"><strong>{t('risks.overdueReview')}</strong><span>{riskRows.filter(r => r.next_review_date && new Date(r.next_review_date) < new Date()).length} {t('risks.overdueReviewHint')}</span></div>
      </div>



      <div className="panel">
        <div className="panel-header"><div><h4>{t('risks.register')}</h4><p className="muted">{t('risks.registerHint')}</p></div><span className="status-chip neutral">{t('risks.recordSource')}</span></div>
        <DataState
          loading={risks.loading}
          error={risks.error}
          empty={!risks.data?.length}
          emptyTitle={t('risks.g.noRisks', 'No risks in your scope')}
          emptyMessage={
            canManageRisks
              ? t('risks.g.noRisksManage', 'Start by adding an identified risk with an owner, treatment and review date.')
              : t('risks.g.noRisksReadOnly', 'No risk records are currently available for this read-only role and scope.')
          }
        >
          <EntityTable<RiskRow>
            rows={risks.data || []}
            getRowKey={row => row.id}
            columns={[
              { key: 'code', header: t('common.code'), render: row => row.risk_code || '—' },
              { key: 'title', header: t('common.risk'), render: row => <strong>{row.title}</strong> },
              { key: 'category', header: t('risks.category'), render: row => humanize(row.category) },
              { key: 'department', header: t('common.department'), render: row => departmentName(row.departments) },
              { key: 'owner', header: t('common.owner'), render: row => ownerName(row.owner) },
              { key: 'score', header: t('risks.score'), render: row => `${row.inherent_score} → ${row.residual_score}` },
              { key: 'appetite', header: t('risks.appetite'), render: row => row.appetite_breached ? <span className="risk-pill high">{t('status.breached', 'Breached')}</span> : <span className="status-chip good">{t('status.within', 'Within')}</span> },
              { key: 'treatment', header: t('risks.treatment'), render: row => <StatusBadge status={t(`status.${row.treatment_status || 'not_required'}`, humanize(row.treatment_status || 'not required'))} /> },
              { key: 'review', header: t('risks.nextReview'), render: row => formatDate(row.next_review_date) },
              { key: 'status', header: t('common.status'), render: row => <StatusBadge status={t(`status.${row.status}`, humanize(row.status))} /> },
              { key: 'level', header: t('risks.level'), render: row => <span className={`risk-pill ${row.risk_level}`}>{t(`risk.${row.risk_level}`, row.risk_level)}</span> },
              { key: 'actions', header: t('common.actions'), render: row => <button className="ghost-button" onClick={() => setSelectedRisk(row)}>{t('risks.workflow')}</button> }
            ]}
          />
        </DataState>
      </div>



      <details className="panel" style={{ marginTop: '16px', border: 'none', background: 'transparent', boxShadow: 'none' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '12px 16px', background: 'var(--panel-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
          {t('risks.g.showWorkflowQueues', 'Show risk workflow queues')} ({queueRows.length} {t('audit.active', 'active')})
        </summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
<div className="panel">
        <div className="panel-header">
          
          <span className="status-chip warning">{queueRows.length} {t('audit.active', 'active')}</span>
        </div>
        <div className="module-grid">
          <div className="module-card danger"><strong>{t('risks.g.appetiteBreaches', 'Appetite breaches')}</strong><span>{breachRows.length} {t('risks.g.appetiteBreachesHint', 'risks above appetite or tolerance.')}</span></div>
          <div className="module-card warning"><strong>{t('risks.g.treatmentQueue', 'Treatment queue')}</strong><span>{treatmentRows.length} {t('risks.g.treatmentQueueHint', 'treatment plans required or overdue.')}</span></div>
          <div className="module-card warning"><strong>{t('risks.g.kriAlerts', 'KRI alerts')}</strong><span>{kriRows.length} {t('risks.g.kriAlertsHint', 'warning or critical early signals.')}</span></div>
          <div className="module-card danger"><strong>{t('risks.g.executiveEscalations', 'Executive escalations')}</strong><span>{escalationRows.length} {t('risks.g.executiveEscalationsHint', 'board or executive-visible risks.')}</span></div>
          <div className="module-card"><strong>{t('risks.g.closureBlockers', 'Closure blockers')}</strong><span>{blockerRows.filter(row => row.blocker_reason).length} {t('risks.g.closureBlockersHint', 'risks blocked by evidence, review, KRI, acceptance or treatment rules.')}</span></div>
        </div>
        <DataState
          loading={workflowQueue.loading}
          error={workflowQueue.error}
          empty={!queueRows.length}
          emptyTitle={t('risks.g.noWorkflowItems', 'No risk workflow items')}
          emptyMessage={t('risks.g.noWorkflowItemsHint', 'Risks needing review, treatment, acceptance, closure approval or escalation will appear here.')}
        >
          <EntityTable
            rows={queueRows.slice(0, 12)}
            getRowKey={row => `${row.risk_id}-${row.queue_reason}`}
            columns={[
              { key: 'risk', header: t('common.risk', 'Risk'), render: row => <button className="link-button" onClick={() => setSelectedRisk(riskRows.find(risk => risk.id === row.risk_id) || null)}>{row.risk_code || row.title}</button> },
              { key: 'reason', header: t('audit.g.reason', 'Reason'), render: row => humanize(row.queue_reason, language) },
              { key: 'owner', header: t('common.owner', 'Owner'), render: row => row.risk_owner_name || '—' },
              { key: 'due', header: t('common.dueDate', 'Due'), render: row => formatDate(row.due_date) },
              { key: 'status', header: t('common.status', 'Status'), render: row => <StatusBadge status={humanize(row.status, language)} /> },
              { key: 'risk', header: t('risks.level', 'Level'), render: row => <span className={`risk-pill ${row.risk_level}`}>{humanize(row.risk_level, language)}</span> },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div><h4>{t('risks.g.treatmentQueue', 'Treatment queue')}</h4><p className="muted">{t('risks.g.treatmentQueueDesc', 'Treatment-required and overdue risks with accountable owner and due date.')}</p></div>
          <span className="status-chip warning">{treatmentRows.length} queued</span>
        </div>
        <DataState loading={treatmentQueue.loading} error={treatmentQueue.error} empty={!treatmentRows.length} emptyTitle={t('risks.g.noTreatmentItems', 'No treatment queue items')}>
          <EntityTable
            rows={treatmentRows.slice(0, 12)}
            getRowKey={row => row.risk_id}
            columns={[
              { key: 'risk', header: t('common.risk', 'Risk'), render: row => <button className="link-button" onClick={() => setSelectedRisk(riskRows.find(risk => risk.id === row.risk_id) || null)}>{row.risk_code || row.title}</button> },
              { key: 'score', header: t('risks.g.residual', 'Residual'), render: row => row.residual_score },
              { key: 'status', header: t('risks.treatment', 'Treatment'), render: row => <StatusBadge status={humanize(row.treatment_status)} /> },
              { key: 'owner', header: t('common.owner', 'Owner'), render: row => row.treatment_owner_name || '—' },
              { key: 'due', header: t('common.due', 'Due'), render: row => formatDate(row.treatment_due_date) },
              { key: 'overdue', header: t('common.overdue', 'Overdue'), render: row => row.treatment_overdue ? <span className="risk-pill high">{t('common.overdue', 'Overdue')}</span> : <span className="status-chip good">{t('risks.g.onTrack', 'On track')}</span> },
            ]}
          />
        </DataState>
      </div>

      <div className="two-column">
        <div className="panel">
          <div className="panel-header"><div><h4>{t('risks.g.appetiteBreaches', 'Appetite breaches')}</h4><p className="muted">{t('risks.g.appetiteBreachesDesc', 'Residual exposure outside approved tolerance.')}</p></div></div>
          <DataState loading={appetiteBreaches.loading} error={appetiteBreaches.error} empty={!breachRows.length} emptyTitle={t('risks.g.noAppetiteBreaches', 'No appetite breaches')}>
            <EntityTable
              rows={breachRows.slice(0, 8)}
              getRowKey={row => row.risk_id}
              columns={[
                { key: 'risk', header: t('common.risk', 'Risk'), render: row => row.risk_code || row.title },
                { key: 'score', header: t('risks.g.residual', 'Residual'), render: row => `${row.residual_score}/${row.appetite_threshold}` },
                { key: 'acceptance', header: t('risks.g.acceptance', 'Acceptance'), render: row => <StatusBadge status={humanize(row.acceptance_status)} /> },
              ]}
            />
          </DataState>
        </div>
        <div className="panel">
          <div className="panel-header"><div><h4>{t('risks.g.closureBlockers', 'Closure blockers')}</h4><p className="muted">{t('risks.g.closureBlockersDesc', 'Risks cannot close while a blocker remains active.')}</p></div></div>
          <DataState loading={closureBlockers.loading} error={closureBlockers.error} empty={!blockerRows.filter(row => row.blocker_reason).length} emptyTitle={t('risks.g.noClosureBlockers', 'No closure blockers')}>
            <EntityTable
              rows={blockerRows.filter(row => row.blocker_reason).slice(0, 8)}
              getRowKey={row => row.risk_id}
              columns={[
                { key: 'risk', header: t('common.risk', 'Risk'), render: row => row.risk_code || row.title },
                { key: 'blocker', header: t('risks.g.blocker', 'Blocker'), render: row => row.blocker_reason || '—' },
              ]}
            />
          </DataState>
        </div>
      </div>

      <div className="two-column">
        <div className="panel">
          <div className="panel-header"><div><h4>{t('risks.g.kriAlerts', 'KRI alerts')}</h4><p className="muted">{t('risks.g.kriAlertsDesc', 'Warning and critical indicators tied to risk records.')}</p></div></div>
          <DataState loading={kriAlerts.loading} error={kriAlerts.error} empty={!kriRows.length} emptyTitle={t('risks.g.noKriAlerts', 'No KRI alerts')}>
            <EntityTable
              rows={kriRows.slice(0, 8)}
              getRowKey={row => row.kri_id}
              columns={[
                { key: 'kri', header: 'KRI', render: row => row.kri_code || row.name_en },
                { key: 'risk', header: t('common.risk', 'Risk'), render: row => row.risk_code || row.risk_title },
                { key: 'value', header: t('risks.g.value', 'Value'), render: row => row.current_value ?? '—' },
                { key: 'status', header: t('common.status', 'Status'), render: row => <StatusBadge status={humanize(row.status)} /> },
              ]}
            />
          </DataState>
        </div>
        <div className="panel">
          <div className="panel-header"><div><h4>{t('risks.g.executiveEscalations', 'Executive escalations')}</h4><p className="muted">{t('risks.g.executiveEscalationsDesc', 'Critical or executive-visible risk exposure.')}</p></div></div>
          <DataState loading={executiveEscalations.loading} error={executiveEscalations.error} empty={!escalationRows.length} emptyTitle={t('risks.g.noExecutiveEscalations', 'No executive escalations')}>
            <EntityTable
              rows={escalationRows.slice(0, 8)}
              getRowKey={row => row.risk_id}
              columns={[
                { key: 'risk', header: t('common.risk', 'Risk'), render: row => row.risk_code || row.title },
                { key: 'score', header: t('risks.g.residual', 'Residual'), render: row => row.residual_score },
                { key: 'level', header: t('risks.g.escalation', 'Escalation'), render: row => humanize(row.escalation_level) },
                { key: 'owner', header: t('common.owner', 'Owner'), render: row => row.executive_owner_name || '—' },
              ]}
            />
          </DataState>
        </div>
      </div>


        </div>
      </details>
      <Modal
        open={formOpen}
        title={t('risks.g.createTitle', 'Create risk')}
        isDirty={riskFormDirty}
        isSubmitting={riskFormSubmitting}
        onClose={closeRiskForm}
      >
        <RiskForm
          organizationId={organizationId}
          departments={departments.data || []}
          profiles={profiles.data || []}
          onDirtyChange={setRiskFormDirty}
          onSubmittingChange={setRiskFormSubmitting}
          onCancel={closeRiskForm}
          onCreated={() => {
            closeRiskForm();
            void risks.refresh();
          }}
        />
      </Modal>

      <Modal open={Boolean(selectedRisk)} title={t('risks.g.workflowDetail', 'Risk workflow detail')} onClose={() => setSelectedRisk(null)}>
        {selectedRisk ? (
          <div className="form-grid">
            {selectedWarnings.length ? (
              <div className="notice-banner full-width">
                {selectedWarnings.map(warning => <div key={warning}>{warning}</div>)}
              </div>
            ) : null}
            <div className="mini-card"><span>{t('common.risk', 'Risk')}</span><strong>{selectedRisk.risk_code || selectedRisk.title}</strong></div>
            <div className="mini-card"><span>{t('risks.decision.inherentScore', 'Inherent score')}</span><strong>{selectedRisk.inherent_score}</strong></div>
            <div className="mini-card"><span>{t('risks.decision.residualScore', 'Residual score')}</span><strong>{selectedRisk.residual_score}</strong></div>
            <div className="mini-card"><span>{t('risks.appetite', 'Appetite')}</span><strong>{selectedRisk.appetite_breached ? t('status.breached', 'Breached') : t('risks.g.withinAppetite', 'Within appetite')}</strong></div>
            <div className="mini-card"><span>{t('form.risk.owner', 'Risk owner')}</span><strong>{ownerName(selectedRisk.risk_owner || selectedRisk.owner)}</strong></div>
            <div className="mini-card"><span>{t('risks.g.controlOwner', 'Control owner')}</span><strong>{ownerName(selectedRisk.control_owner)}</strong></div>
            <div className="mini-card"><span>{t('risks.g.treatmentOwner', 'Treatment owner')}</span><strong>{ownerName(selectedRisk.treatment_owner)}</strong></div>
            <div className="mini-card"><span>{t('risks.g.executiveSponsor', 'Executive sponsor')}</span><strong>{ownerName(selectedRisk.executive_sponsor)}</strong></div>
            <div className="mini-card"><span>{t('risks.treatment', 'Treatment')}</span><strong>{humanize(selectedRisk.treatment_status || 'not_required')}</strong></div>
            <div className="mini-card"><span>{t('risks.g.acceptance', 'Acceptance')}</span><strong>{humanize(selectedRisk.acceptance_status || 'not_required')}</strong></div>
            <div className="mini-card"><span>{t('risks.nextReview', 'Next review')}</span><strong>{formatDate(selectedRisk.next_review_date)}</strong></div>
            <div className="mini-card"><span>{t('risks.g.closure', 'Closure')}</span><strong>{selectedBlocker?.blocker_reason || selectedRisk.closure_reason || t('risks.g.noActiveBlocker', 'No active blocker')}</strong></div>

            <div className="panel full-width">
              <h4>{t('risks.g.linkedSources', 'Linked sources')}</h4>
              <div className="module-grid">
                <div className="mini-card"><span>OVR</span><strong>{selectedRisk.source_ovr_id || '—'}</strong></div>
                <div className="mini-card"><span>{t('risks.g.auditFinding', 'Audit finding')}</span><strong>{selectedRisk.source_audit_finding_id || '—'}</strong></div>
                <div className="mini-card"><span>{t('risks.g.compliance', 'Compliance')}</span><strong>{selectedRisk.source_compliance_id || '—'}</strong></div>
                <div className="mini-card"><span>{t('risks.g.project', 'Project')}</span><strong>{selectedRisk.source_project_id || '—'}</strong></div>
              </div>
            </div>

            {selectedQueueRows.length ? (
              <div className="panel full-width">
                <h4>{t('risks.g.activeReasons', 'Active workflow reasons')}</h4>
                <ul>
                  {selectedQueueRows.map(row => <li key={`${row.risk_id}-${row.queue_reason}`}>{humanize(row.queue_reason)} · {formatDate(row.due_date)}</li>)}
                </ul>
              </div>
            ) : null}

            <div className="panel full-width">
              <h4>{t('risks.g.reassessmentHistory', 'Reassessment history')}</h4>
              {riskHistory.length ? (
                <EntityTable
                  rows={riskHistory}
                  getRowKey={row => row.id}
                  columns={[
                    { key: 'date', header: t('risks.g.changed', 'Changed'), render: row => formatDate(row.changed_at) },
                    { key: 'old', header: t('risks.g.previous', 'Previous'), render: row => `${row.previous_score ?? '—'} / ${row.previous_residual_score ?? '—'}` },
                    { key: 'new', header: t('risks.g.new', 'New'), render: row => `${row.new_score ?? '—'} / ${row.new_residual_score ?? '—'}` },
                    { key: 'reason', header: t('audit.g.reason', 'Reason'), render: row => row.change_reason || '—' },
                  ]}
                />
              ) : <p className="muted">{t('risks.g.noReassessmentHistory', 'No reassessment history is visible yet.')}</p>}
            </div>

            <div className="panel full-width">
              <h4>{t('risks.g.workflowEvents', 'Workflow events')}</h4>
              {riskEvents.length ? (
                <EntityTable
                  rows={riskEvents}
                  getRowKey={row => row.id}
                  columns={[
                    { key: 'date', header: t('common.date', 'Date'), render: row => formatDate(row.created_at) },
                    { key: 'action', header: t('common.actions', 'Action'), render: row => humanize(row.action, language) },
                    { key: 'status', header: t('common.status', 'Status'), render: row => `${humanize(row.from_status, language) || '—'} → ${humanize(row.to_status, language) || '—'}` },
                    { key: 'note', header: t('audit.g.noteComment', 'Note'), render: row => row.note || '—' },
                  ]}
                />
              ) : <p className="muted">{t('risks.g.noWorkflowEvents', 'No workflow events are visible yet.')}</p>}
            </div>

            {canManageRisks ? (
              <div className="form-actions full-width">
                <button className="ghost-button" disabled={workflowBusy} onClick={() => setDecisionDialog({ action: 'reassess', risk: selectedRisk })}>{t('risks.g.reassess', 'Reassess risk')}</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => setDecisionDialog({ action: 'request_acceptance', risk: selectedRisk })}>{t('risks.g.requestAcceptance', 'Request acceptance')}</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => void runRiskAction(t('risks.g.acceptanceApproval', 'Acceptance approval'), () => approveRiskAcceptance({ risk_id: selectedRisk.id, reason: 'Approved from workflow center' }))}>{t('risks.g.approveAcceptance', 'Approve acceptance')}</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => void runRiskAction(t('risks.g.acceptanceRejection', 'Acceptance rejection'), () => rejectRiskAcceptance({ risk_id: selectedRisk.id, reason: 'Rejected from workflow center' }))}>{t('risks.g.rejectAcceptance', 'Reject acceptance')}</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => setDecisionDialog({ action: 'update_treatment', risk: selectedRisk })}>{t('risks.g.updateTreatment', 'Update treatment')}</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => void runRiskAction(t('risks.g.treatmentCompletion', 'Treatment completion'), () => completeRiskTreatment({ risk_id: selectedRisk.id, reason: 'Treatment completed from workflow center' }))}>{t('risks.g.completeTreatment', 'Complete treatment')}</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => setDecisionDialog({ action: 'request_closure', risk: selectedRisk })}>{t('audit.requestClosure', 'Request closure')}</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => void runRiskAction(t('risks.g.closureApproval', 'Closure approval'), () => approveRiskClosure({ risk_id: selectedRisk.id, reason: 'Approved from workflow center' }))}>{t('risks.g.approveClosure', 'Approve closure')}</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => setDecisionDialog({ action: 'reopen', risk: selectedRisk })}>{t('risks.g.reopen', 'Reopen with reason')}</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => setDecisionDialog({ action: 'link_source', risk: selectedRisk })}>{t('risks.g.linkSource', 'Link source')}</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => setDecisionDialog({ action: 'mark_duplicate', risk: selectedRisk })}>{t('risks.g.markDuplicate', 'Mark duplicate')}</button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <GovernedDecisionDialog
        open={Boolean(decisionDialog)}
        title={
          decisionDialog?.action === 'reassess'
            ? t('risks.decision.reassessTitle')
            : decisionDialog?.action === 'request_acceptance'
            ? t('risks.decision.requestAcceptanceTitle')
            : decisionDialog?.action === 'update_treatment'
            ? t('risks.decision.updateTreatmentTitle')
            : decisionDialog?.action === 'link_source'
            ? t('risks.decision.linkSourceTitle')
            : decisionDialog?.action === 'mark_duplicate'
            ? t('risks.decision.markDuplicateTitle')
            : decisionDialog?.action === 'request_closure'
            ? t('risks.decision.closureRequestTitle')
            : decisionDialog?.action === 'reopen'
            ? t('risks.decision.reopenTitle')
            : ''
        }
        subtitle={
          decisionDialog?.action === 'reassess'
            ? t('risks.decision.reassessSubtitle')
            : undefined
        }
        decisionVariant={
          decisionDialog?.action === 'reopen'
            ? 'warning'
            : decisionDialog?.action === 'request_closure'
            ? 'approve'
            : 'action'
        }
        contextItems={
          decisionDialog
            ? [
                {
                  label: 'Risk',
                  value: decisionDialog.risk.risk_code || decisionDialog.risk.title,
                },
                {
                  label: t('risks.decision.inherentScore'),
                  value: decisionDialog.risk.inherent_score ?? (decisionDialog.risk.likelihood * decisionDialog.risk.impact),
                },
                {
                  label: t('risks.decision.residualScore'),
                  value: decisionDialog.risk.residual_score ?? ((decisionDialog.risk.residual_likelihood ?? 3) * (decisionDialog.risk.residual_impact ?? 3)),
                },
                {
                  label: t('risks.decision.appetiteStatus'),
                  value: decisionDialog.risk.appetite_breached ? 'Breached' : 'Within appetite',
                },
              ]
            : []
        }
        fields={
          !decisionDialog
            ? []
            : decisionDialog.action === 'reassess'
            ? [
                {
                  id: 'residual_likelihood',
                  label: t('risks.decision.residualLikelihood'),
                  type: 'select',
                  defaultValue: String(decisionDialog.risk.residual_likelihood ?? 3),
                  options: [
                    { value: '1', label: '1 - Very Low' },
                    { value: '2', label: '2 - Low' },
                    { value: '3', label: '3 - Medium' },
                    { value: '4', label: '4 - High' },
                    { value: '5', label: '5 - Critical' },
                  ],
                  required: true,
                },
                {
                  id: 'residual_impact',
                  label: t('risks.decision.residualImpact'),
                  type: 'select',
                  defaultValue: String(decisionDialog.risk.residual_impact ?? 3),
                  options: [
                    { value: '1', label: '1 - Negligible' },
                    { value: '2', label: '2 - Minor' },
                    { value: '3', label: '3 - Moderate' },
                    { value: '4', label: '4 - Major' },
                    { value: '5', label: '5 - Catastrophic' },
                  ],
                  required: true,
                },
                {
                  id: 'change_reason',
                  label: t('risks.decision.reassessReason'),
                  type: 'textarea',
                  defaultValue: '',
                  placeholder: 'Document why the residual score has changed…',
                  required: true,
                  autoFocus: true,
                },
              ]
            : decisionDialog.action === 'request_acceptance'
            ? [
                {
                  id: 'reason',
                  label: t('risks.decision.acceptanceReason'),
                  type: 'textarea',
                  defaultValue: '',
                  placeholder: 'State the governance justification for accepting this residual risk…',
                  required: true,
                  autoFocus: true,
                },
                {
                  id: 'acceptance_expiry_date',
                  label: t('risks.decision.acceptanceExpiry'),
                  type: 'date',
                  defaultValue: decisionDialog.risk.acceptance_expiry_date || defaultExpiryDate(),
                  required: true,
                },
              ]
            : decisionDialog.action === 'update_treatment'
            ? [
                {
                  id: 'treatment_plan_summary',
                  label: t('risks.decision.treatmentSummary'),
                  type: 'textarea',
                  defaultValue: decisionDialog.risk.treatment_plan_summary || '',
                  placeholder: 'Detail the mitigation and treatment actions…',
                  required: true,
                  autoFocus: true,
                },
                {
                  id: 'treatment_due_date',
                  label: t('risks.decision.treatmentDueDate'),
                  type: 'date',
                  defaultValue: decisionDialog.risk.treatment_due_date || defaultExpiryDate(),
                  required: false,
                },
              ]
            : decisionDialog.action === 'link_source'
            ? [
                {
                  id: 'source_ovr_id',
                  label: t('risks.decision.sourceOvr'),
                  type: 'text',
                  defaultValue: decisionDialog.risk.source_ovr_id || '',
                  placeholder: 'OVR-UUID',
                },
                {
                  id: 'source_audit_finding_id',
                  label: t('risks.decision.sourceAudit'),
                  type: 'text',
                  defaultValue: decisionDialog.risk.source_audit_finding_id || '',
                  placeholder: 'AUDIT-FINDING-UUID',
                },
                {
                  id: 'source_compliance_id',
                  label: t('risks.decision.sourceCompliance'),
                  type: 'text',
                  defaultValue: decisionDialog.risk.source_compliance_id || '',
                  placeholder: 'COMPLIANCE-UUID',
                },
                {
                  id: 'source_project_id',
                  label: t('risks.decision.sourceProject'),
                  type: 'text',
                  defaultValue: decisionDialog.risk.source_project_id || '',
                  placeholder: 'PROJECT-UUID',
                },
              ]
            : decisionDialog.action === 'mark_duplicate'
            ? [
                {
                  id: 'duplicate_of_risk_id',
                  label: t('risks.decision.duplicateTargetId'),
                  type: 'text',
                  defaultValue: decisionDialog.risk.duplicate_of_risk_id || '',
                  placeholder: 'Target Risk UUID',
                  required: true,
                  autoFocus: true,
                },
                {
                  id: 'reason',
                  label: t('risks.decision.duplicateReason'),
                  type: 'textarea',
                  defaultValue: 'Duplicate or related risk signal',
                  required: false,
                },
              ]
            : decisionDialog.action === 'request_closure'
            ? [
                {
                  id: 'reason',
                  label: t('risks.decision.closureReason'),
                  type: 'textarea',
                  defaultValue: '',
                  placeholder: 'Document why this risk is eligible for formal closure…',
                  required: false,
                  autoFocus: true,
                },
              ]
            : [
                {
                  id: 'reason',
                  label: t('risks.decision.reopenReason'),
                  type: 'textarea',
                  defaultValue: '',
                  placeholder: 'Explain the new circumstances or residual escalation requiring reopening…',
                  required: false,
                  autoFocus: true,
                },
              ]
        }
        onClose={() => setDecisionDialog(null)}
        onSubmit={executeRiskDecision}
      />
    </section>
  );
}
