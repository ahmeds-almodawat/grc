import '../../styles/v230-compliance-hardening.css';
import { v230PolicyDocuments } from '../../lib/v230ComplianceHardeningModel';

function statusClass(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function PolicyAttestationTracker() {
  return (
    <section className="v230-panel" aria-label="v23 policy attestation tracker">
      <div className="v230-panel-heading compact">
        <p className="eyebrow">Policy lifecycle</p>
        <h3>Versioned policy register and attestation tracker</h3>
        <p>Policies should not be treated as current unless the approved version, owner, review cycle and required audience attestation are recorded.</p>
      </div>

      <div className="v230-table v230-policy-table" role="table" aria-label="Policy attestation table">
        <div className="v230-row v230-head" role="row">
          <span>Policy</span>
          <span>Owner</span>
          <span>Framework</span>
          <span>Version</span>
          <span>Attestation</span>
        </div>
        {v230PolicyDocuments.map(policy => (
          <div className="v230-row" role="row" key={policy.id}>
            <span><strong>{policy.policyCode}</strong><small>{policy.title}</small></span>
            <span>{policy.owner}</span>
            <span>{policy.frameworkLinks.join(' / ')}</span>
            <span>{policy.version}<small>{policy.nextReviewDate}</small></span>
            <span><mark className={`v230-status ${statusClass(policy.attestationStatus)}`}>{policy.attestationStatus.replace(/_/g, ' ')}</mark><small>{policy.requiredAudience}</small></span>
          </div>
        ))}
      </div>
    </section>
  );
}
