import { v170RiskTraceabilityItems } from '../../lib/v170EnterpriseRiskModel';

export function RiskControlTraceabilityPanel() {
  return (
    <div className="panel v170-risk-panel">
      <div className="panel-header">
        <div>
          <h4>Risk-control-test-evidence traceability</h4>
          <p className="muted">A professional ERM program should connect top risks to controls, tests, evidence, issues/CAPA and reporting outputs.</p>
        </div>
        <span className="status-chip neutral">Traceability map</span>
      </div>
      <div className="v170-traceability-table">
        <div className="v170-traceability-row header">
          <span>Risk</span>
          <span>Control</span>
          <span>Test / evidence</span>
          <span>Issue / CAPA</span>
          <span>Reporting</span>
        </div>
        {v170RiskTraceabilityItems.map(item => (
          <div className="v170-traceability-row" key={item.id}>
            <span>{item.risk}</span>
            <span>{item.linkedControl}</span>
            <span>{item.test}<small>{item.evidence}</small></span>
            <span>{item.issueOrCapa}</span>
            <span>{item.reportOutput}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
