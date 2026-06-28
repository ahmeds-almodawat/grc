import {
  getV160ComplianceReadiness,
  v160ComplianceCapabilities,
  v160ComplianceProgramMetrics,
} from '../../lib/v160ComplianceManagementModel';

function statusClass(status: string) {
  if (status === 'Implemented') return 'good';
  if (status === 'Partially implemented') return 'warning';
  return 'neutral';
}

export function ComplianceObligationMaturityPanel() {
  const readiness = getV160ComplianceReadiness();

  return (
    <div className="panel v160-panel">
      <div className="panel-header">
        <div>
          <span className="v160-eyebrow">ISO 37301-style maturity view</span>
          <h4>Compliance program maturity</h4>
        </div>
        <span className={`status-chip ${readiness.readinessPercent >= 80 ? 'good' : 'warning'}`}>
          {readiness.readinessPercent}% readiness
        </span>
      </div>

      <div className="v160-score-strip">
        <div className="mini-card"><span>Total capabilities</span><strong>{readiness.total}</strong></div>
        <div className="mini-card"><span>Implemented</span><strong>{readiness.implemented}</strong></div>
        <div className="mini-card"><span>Partial</span><strong>{readiness.partial}</strong></div>
        <div className="mini-card"><span>Next layer</span><strong>{readiness.next}</strong></div>
      </div>

      <div className="notice-banner v160-recommendation">{readiness.recommendation}</div>

      <div className="v160-capability-grid">
        {v160ComplianceCapabilities.map(capability => (
          <article className="v160-capability-card" key={capability.id}>
            <div className="v160-card-header">
              <h5>{capability.title}</h5>
              <span className={`status-chip ${statusClass(capability.status)}`}>{capability.status}</span>
            </div>
            <p>{capability.purpose}</p>
            <small>{capability.standardBasis}</small>
            <ul>
              {capability.evidenceRequired.map(evidence => <li key={evidence}>{evidence}</li>)}
            </ul>
          </article>
        ))}
      </div>

      <div className="v160-metric-grid">
        {v160ComplianceProgramMetrics.map(metric => (
          <div className="mini-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.interpretation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
