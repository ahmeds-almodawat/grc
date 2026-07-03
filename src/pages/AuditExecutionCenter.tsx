import { useState } from 'react';
import { DataState } from '../components/DataState';
import { ModernCard } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { getAuditEngagementRegister, type AuditEngagementRegisterRow } from '../lib/clinicalGovernanceApi';

function statusClass(status: string) {
  switch (status) {
    case 'active':
    case 'fieldwork':
      return 'primary';
    case 'reporting':
      return 'warning';
    case 'closed':
      return 'success';
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'TBD';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export function AuditExecutionCenter() {
  const [refreshCount, setRefreshCount] = useState(0);
  const { data: result, loading, error } = useAsyncData(() => getAuditEngagementRegister(), [refreshCount]);
  const engagements = result?.data ?? [];

  return (
    <div className="page-stack">
      <div className="panel-header">
        <div>
          <h2>Audit Execution Center</h2>
          <p>Live Patch 37 audit engagements replacing the previous static engagement checklist.</p>
        </div>
        <button className="ghost-button" type="button" onClick={() => setRefreshCount(count => count + 1)}>
          Refresh
        </button>
      </div>

      <DataState
        loading={loading}
        error={error}
        empty={engagements.length === 0}
        emptyTitle="No live audit engagements found"
        emptyMessage="Create or import audit engagements through the Patch 37 clinical governance backend to activate execution tracking."
      >
        <div className="module-grid">
          {engagements.map((engagement: AuditEngagementRegisterRow) => (
            <ModernCard
              key={engagement.id ?? engagement.engagement_title ?? 'audit-engagement'}
              title={engagement.engagement_title ?? 'Untitled engagement'}
              subtitle={(engagement.engagement_type ?? 'internal_audit').replaceAll('_', ' ')}
            >
              <div className="detail-grid">
                <div>
                  <span>Status</span>
                  <strong className={`status-badge ${statusClass(engagement.status ?? 'planned')}`}>
                    {(engagement.status ?? 'planned').replaceAll('_', ' ')}
                  </strong>
                </div>
                <div>
                  <span>Start</span>
                  <strong>{formatDate(engagement.starts_on)}</strong>
                </div>
                <div>
                  <span>End</span>
                  <strong>{formatDate(engagement.ends_on)}</strong>
                </div>
                <div>
                  <span>Scope</span>
                  <strong>{engagement.scope_summary ?? '-'}</strong>
                </div>
              </div>
            </ModernCard>
          ))}
        </div>
      </DataState>
    </div>
  );
}
