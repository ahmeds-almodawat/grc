import { useState } from 'react';
import { DataState } from '../components/DataState';
import { ModernCard } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { getOvrRcaCaseRegister, type OvrRcaCaseRegisterRow } from '../lib/clinicalGovernanceApi';

function statusClass(status: string) {
  switch (status) {
    case 'open':
    case 'in_progress':
      return 'primary';
    case 'awaiting_review':
      return 'warning';
    case 'capa_required':
      return 'danger';
    case 'closed':
      return 'success';
    default:
      return 'neutral';
  }
}

function severityClass(severity: string) {
  if (severity === 'high' || severity === 'critical' || severity === 'sentinel') return 'danger';
  if (severity === 'medium') return 'warning';
  return 'neutral';
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No due date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export function OvrRcaCenter() {
  const [refreshCount, setRefreshCount] = useState(0);
  const { data: result, loading, error } = useAsyncData(() => getOvrRcaCaseRegister(), [refreshCount]);
  const cases = result?.data ?? [];

  return (
    <div className="page-stack">
      <div className="panel-header">
        <div>
          <h2>OVR Root Cause Analysis</h2>
          <p>Live Patch 37 RCA cases for patient safety incidents, CAPA links, and governance follow-up.</p>
        </div>
        <button className="ghost-button" type="button" onClick={() => setRefreshCount(count => count + 1)}>
          Refresh
        </button>
      </div>

      <DataState
        loading={loading}
        error={error}
        empty={cases.length === 0}
        emptyTitle="No OVR RCA cases found"
        emptyMessage="Submitted OVR incidents that require RCA will appear here after Patch 37 clinical governance records are created."
      >
        <div className="module-grid">
          {cases.map((rca: OvrRcaCaseRegisterRow) => (
            <ModernCard
              key={rca.id ?? rca.rca_title ?? 'ovr-rca-case'}
              title={rca.rca_title ?? 'Untitled RCA'}
              subtitle={`Incident: ${rca.incident_reference ?? '-'}`}
            >
              <div className="detail-grid">
                <div>
                  <span>Status</span>
                  <strong className={`status-badge ${statusClass(rca.rca_status ?? 'open')}`}>
                    {(rca.rca_status ?? 'open').replaceAll('_', ' ')}
                  </strong>
                </div>
                <div>
                  <span>Severity</span>
                  <strong className={`status-badge ${severityClass(rca.severity ?? 'medium')}`}>
                    {rca.severity ?? 'medium'}
                  </strong>
                </div>
                <div>
                  <span>Due</span>
                  <strong>{formatDate(rca.due_date)}</strong>
                </div>
                <div>
                  <span>Active links</span>
                  <strong>{rca.active_link_count ?? 0}</strong>
                </div>
              </div>
              {rca.root_cause_summary ? <p className="muted">{rca.root_cause_summary}</p> : null}
            </ModernCard>
          ))}
        </div>
      </DataState>
    </div>
  );
}
