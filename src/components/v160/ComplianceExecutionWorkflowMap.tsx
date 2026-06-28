import {
  v160ComplianceExecutionChain,
  v160ComplianceExecutionSteps,
} from '../../lib/v160ComplianceManagementModel';

export function ComplianceExecutionWorkflowMap() {
  return (
    <div className="panel v160-panel v160-workflow-panel">
      <div className="panel-header">
        <div>
          <span className="v160-eyebrow">v16 Compliance Management System</span>
          <h4>Compliance execution chain</h4>
        </div>
        <span className="status-chip good">Controlled CMS workflow</span>
      </div>
      <p className="muted v160-chain">{v160ComplianceExecutionChain}</p>
      <div className="v160-workflow-grid">
        {v160ComplianceExecutionSteps.map((step, index) => (
          <article className="v160-workflow-card" key={step.id}>
            <span className="v160-step-number">{String(index + 1).padStart(2, '0')}</span>
            <h5>{step.title}</h5>
            <p>{step.output}</p>
            <dl>
              <div>
                <dt>Owner</dt>
                <dd>{step.owner}</dd>
              </div>
              <div>
                <dt>Control point</dt>
                <dd>{step.controlPoint}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
