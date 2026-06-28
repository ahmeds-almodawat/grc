import { v150AuditMetrics } from '../../lib/v150AuditProgramModel';
import '../../styles/v150-audit-program.css';

export function AuditAssuranceCoveragePanel() {
  return (
    <section className="v150-panel" aria-label="Audit assurance coverage summary">
      <div className="v150-panel-header v150-panel-header--split">
        <div>
          <span className="v150-eyebrow">Assurance coverage summary</span>
          <h3>Committee-ready view of coverage, gaps and follow-up risk</h3>
          <p>
            This panel gives Audit and Governance a clear controlled-pilot assurance view without claiming real audit
            outcomes before UAT execution.
          </p>
        </div>
        <div className="v150-score-card v150-score-card--warning">
          <span>Recommendation</span>
          <strong>Controlled UAT</strong>
          <small>Do not treat as broad production assurance</small>
        </div>
      </div>

      <div className="v150-metric-grid">
        {v150AuditMetrics.map((metric) => (
          <article key={metric.label} className={`v150-metric-card ${metric.state}`}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.interpretation}</p>
          </article>
        ))}
      </div>

      <div className="v150-followup-chain">
        <strong>Finding follow-up rule</strong>
        <span>Finding → Management Response → CAPA / Action Plan → Evidence → Audit Review → Closure / Rejection</span>
      </div>
    </section>
  );
}
