import '../../styles/v240-assurance-sod-auditor.css';
import { v240ImmutableAuditControls, v240SodRules } from '../../lib/v240AssuranceSodAuditorModel';

function tone(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function SodImmutableAuditPanel() {
  return (
    <section className="v240-panel v240-two-zone" aria-label="v24 segregation of duties and immutable audit controls">
      <div className="v240-panel-heading compact">
        <p className="eyebrow">Assurance controls</p>
        <h3>Segregation-of-duties rules and immutable audit-log expectations</h3>
        <p>External review depends on independent approval paths and append-only traceability for key decisions, tests, evidence and exports.</p>
      </div>

      <div className="v240-zone-grid">
        <div className="v240-zone">
          <h4>SoD rules</h4>
          {v240SodRules.map(rule => (
            <article className={`v240-zone-card ${tone(rule.severity)}`} key={rule.id}>
              <div className="v240-zone-card-head">
                <strong>{rule.ruleCode}</strong>
                <mark>{rule.severity}</mark>
              </div>
              <h5>{rule.title}</h5>
              <p>{rule.restrictedCombination}</p>
              <small>{rule.enforcement}</small>
            </article>
          ))}
        </div>

        <div className="v240-zone">
          <h4>Immutable audit controls</h4>
          {v240ImmutableAuditControls.map(control => (
            <article className={`v240-zone-card ${tone(control.status)}`} key={control.id}>
              <div className="v240-zone-card-head">
                <strong>{control.control}</strong>
                <mark>{control.status.replace(/_/g, ' ')}</mark>
              </div>
              <p>{control.evidence}</p>
              <small>{control.closureRule}</small>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
