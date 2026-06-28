import { v140DomainProfile, type V140ProfessionalDomain } from '../../lib/v140ProfessionalGrcModel';
import '../../styles/v140-professional-grc.css';

interface ProfessionalGrcMaturityPanelProps {
  domain: V140ProfessionalDomain;
}

export function ProfessionalGrcMaturityPanel({ domain }: ProfessionalGrcMaturityPanelProps) {
  const profile = v140DomainProfile(domain);
  const readyCount = profile.capabilities.filter(item => item.status === 'Ready for controlled pilot').length;
  const gapCount = profile.capabilities.length - readyCount;

  return (
    <section className="v140-panel" aria-label={`${profile.title} professional maturity`}>
      <div className="v140-panel-header v140-panel-header--split">
        <div>
          <span className="v140-eyebrow">v14.0 professional maturity layer</span>
          <h3>{profile.title}</h3>
          <p>{profile.standardsAnchor}</p>
        </div>
        <div className="v140-score-card">
          <span>Maturity score</span>
          <strong>{profile.maturityScore}%</strong>
          <small>{readyCount} pilot-ready / {gapCount} needs depth</small>
        </div>
      </div>

      <div className="v140-recommendation">
        <strong>Recommendation</strong>
        <span>{profile.recommendation}</span>
      </div>

      <div className="v140-capability-grid">
        {profile.capabilities.map((capability) => (
          <article key={capability.id} className="v140-capability-card">
            <div className="v140-capability-topline">
              <span>{capability.maturityStage}</span>
              <em>{capability.status}</em>
            </div>
            <h4>{capability.title}</h4>
            <p>{capability.professionalExpectation}</p>
            <div className="v140-workflow-role">
              <strong>Workflow role</strong>
              <span>{capability.workflowRole}</span>
            </div>
            <div className="v140-evidence-list">
              {capability.evidence.map((item) => <small key={item}>{item}</small>)}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
