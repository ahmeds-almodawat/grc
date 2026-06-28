import { v170RiskExecutionChain, v170RiskLifecycleSteps } from '../../lib/v170EnterpriseRiskModel';

interface RiskExecutionWorkflowMapProps {
  highlight?: string;
}

export function RiskExecutionWorkflowMap({ highlight }: RiskExecutionWorkflowMapProps) {
  return (
    <div className="panel v170-risk-panel">
      <div className="panel-header">
        <div>
          <h4>Enterprise risk execution workflow</h4>
          <p className="muted">{v170RiskExecutionChain}</p>
        </div>
        <span className="status-chip neutral">ERM execution</span>
      </div>
      <div className="v170-risk-workflow-grid">
        {v170RiskLifecycleSteps.map((step, index) => (
          <article
            className={`v170-risk-workflow-step ${highlight === step.id ? 'active' : ''}`}
            key={step.id}
          >
            <span className="v170-step-number">{index + 1}</span>
            <h5>{step.title}</h5>
            <p>{step.description}</p>
            <small><strong>Evidence:</strong> {step.evidence}</small>
            <small><strong>Owner:</strong> {step.owner}</small>
            <span className={`v170-risk-status ${step.status}`}>{step.status.replaceAll('-', ' ')}</span>
          </article>
        ))}
      </div>
    </div>
  );
}
