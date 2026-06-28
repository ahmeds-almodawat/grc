import '../../styles/v190-executive-reporting.css';
import { v190BoardReportSections } from '../../lib/v190ExecutiveGrcReportingModel';

export function BoardReportingPackPanel() {
  return (
    <section className="v190-panel" aria-label="v19 board reporting pack">
      <div className="v190-panel-header">
        <p className="eyebrow">v19 Board Pack</p>
        <h4>Board-ready reporting structure</h4>
        <p>
          Defines the minimum report sections executives should review before committee or board meetings.
        </p>
      </div>

      <div className="v190-board-grid">
        {v190BoardReportSections.map((section) => (
          <article className={`v190-card v190-maturity-${section.maturity}`} key={section.id}>
            <div className="v190-card-head">
              <strong>{section.title}</strong>
              <span>{section.maturity}</span>
            </div>
            <p>{section.purpose}</p>
            <div className="v190-rule">{section.decisionUse}</div>
            <ul>
              {section.requiredEvidence.map((evidence) => <li key={evidence}>{evidence}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
