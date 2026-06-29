import '../../styles/v230-compliance-hardening.css';
import {
  v230HardeningMetrics,
  v230ProfessionalHardeningChain,
  type V230AssuranceStatus
} from '../../lib/v230ComplianceHardeningModel';

function statusLabel(status: V230AssuranceStatus) {
  return status.replace(/_/g, ' ');
}

export function ComplianceHardeningOverview() {
  return (
    <section className="v230-panel v230-hardening-overview" aria-label="v23 compliance hardening overview">
      <div className="v230-panel-heading">
        <p className="eyebrow">v23.0 Compliance hardening</p>
        <h3>Policy, vendor, incident and regulatory-change evidence backbone</h3>
        <p>
          Minimal professional layer for ISO 37301-style compliance management, policy attestation,
          vendor risk, incident readiness and evidence-backed management reporting.
        </p>
      </div>

      <div className="v230-chain" title="Professional compliance hardening chain">
        {v230ProfessionalHardeningChain}
      </div>

      <div className="v230-metric-grid">
        {v230HardeningMetrics.map(metric => (
          <article className={`v230-metric-card ${metric.status}`} key={metric.label}>
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
