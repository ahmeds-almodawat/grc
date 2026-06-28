import {
  getV170RiskReadiness,
  v170RiskAppetiteMetrics,
  v170RiskCapabilities,
  v170RiskTreatmentItems,
} from '../../lib/v170EnterpriseRiskModel';

export function RiskAppetiteTreatmentPanel() {
  const readiness = getV170RiskReadiness();

  return (
    <div className="panel v170-risk-panel">
      <div className="panel-header">
        <div>
          <h4>Risk appetite, KRIs and treatment discipline</h4>
          <p className="muted">Translate risk tolerance into warning thresholds, breach escalation and owned treatment plans.</p>
        </div>
        <span className="status-chip neutral">{readiness.pilotReady}/{readiness.total} pilot-ready</span>
      </div>

      <div className="v170-risk-capability-grid">
        {v170RiskCapabilities.map(capability => (
          <article className="v170-risk-card" key={capability.id}>
            <span>{capability.maturityStage}</span>
            <h5>{capability.title}</h5>
            <p>{capability.professionalPurpose}</p>
            <small>{capability.executionExpectation}</small>
          </article>
        ))}
      </div>

      <div className="v170-three-panel-grid">
        <div className="v170-risk-subpanel">
          <h5>Risk appetite and KRI monitoring</h5>
          {v170RiskAppetiteMetrics.map(metric => (
            <div className="v170-risk-list-item" key={metric.id}>
              <strong>{metric.metric}</strong>
              <span>{metric.appetiteStatement}</span>
              <small>Warning: {metric.warningThreshold}</small>
              <small>Breach: {metric.breachThreshold}</small>
            </div>
          ))}
        </div>
        <div className="v170-risk-subpanel">
          <h5>Risk treatment plan options</h5>
          {v170RiskTreatmentItems.map(item => (
            <div className="v170-risk-list-item" key={item.id}>
              <strong>{item.riskTheme}</strong>
              <span>{item.treatmentStrategy}</span>
              <small>{item.controlLink}</small>
              <small>{item.ownerEvidence}</small>
            </div>
          ))}
        </div>
        <div className="v170-risk-subpanel emphasis">
          <h5>ERM pilot recommendation</h5>
          <p>{readiness.recommendation}</p>
          <small>Use only synthetic or non-confidential risk examples until UAT confirms role access, evidence handling and escalation behavior.</small>
        </div>
      </div>
    </div>
  );
}
