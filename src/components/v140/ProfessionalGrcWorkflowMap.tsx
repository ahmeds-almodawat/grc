import { v140ProfessionalWorkflow, type V140WorkflowStepId } from '../../lib/v140ProfessionalGrcModel';
import '../../styles/v140-professional-grc.css';

interface ProfessionalGrcWorkflowMapProps {
  highlight?: V140WorkflowStepId;
}

export function ProfessionalGrcWorkflowMap({ highlight }: ProfessionalGrcWorkflowMapProps) {
  return (
    <section className="v140-panel v140-workflow-panel" aria-label="Professional GRC workflow chain">
      <div className="v140-panel-header">
        <span className="v140-eyebrow">Professional workflow chain</span>
        <h3>Risk → Control → Test → Evidence → Issue → CAPA → Audit / Compliance Reporting</h3>
        <p>
          This chain is the operating model that turns the platform from a dashboard into a professional GRC,
          risk, compliance and internal audit workflow.
        </p>
      </div>
      <div className="v140-workflow-chain">
        {v140ProfessionalWorkflow.map((step, index) => (
          <article
            key={step.id}
            className={`v140-workflow-step ${highlight === step.id ? 'is-highlighted' : ''}`}
          >
            <span className="v140-step-index">{String(index + 1).padStart(2, '0')}</span>
            <strong>{step.title}</strong>
            <p>{step.purpose}</p>
            <small>{step.output}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
