import '../../styles/v240-assurance-sod-auditor.css';
import {
  v240AssuranceMetrics,
  v240ProfessionalAssuranceChain,
  type V240AssuranceStatus
} from '../../lib/v240AssuranceSodAuditorModel';

function statusLabel(status: V240AssuranceStatus) {
  return status.replace(/_/g, ' ');
}

export function AssuranceReadinessPanel() {
  return (
    <section className="v240-panel v240-assurance-readiness" aria-label="v24 assurance readiness panel">
      <div className="v240-panel-heading">
        <p className="eyebrow">v24.0 Assurance hardening</p>
        <h3>Framework coverage, SoD, immutable log and auditor evidence pack</h3>
        <p>
          Final professionalization layer that turns the GRC platform from connected modules into an external-review-ready
          assurance workspace with clear reliance rules and evidence integrity expectations.
        </p>
      </div>

      <div className="v240-chain" title="Professional assurance chain">
        {v240ProfessionalAssuranceChain}
      </div>

      <div className="v240-metric-grid">
        {v240AssuranceMetrics.map(metric => (
          <article className={`v240-metric-card ${metric.status}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <em>{statusLabel(metric.status)}</em>
            <p>{metric.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
