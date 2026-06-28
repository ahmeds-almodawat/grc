import {
  v160ComplianceTestingCalendar,
  v160PolicyAttestationItems,
  v160RegulatoryChangePipeline,
} from '../../lib/v160ComplianceManagementModel';

function resultClass(result: string) {
  if (result === 'Ready') return 'good';
  if (result === 'Needs evidence') return 'warning';
  return 'danger';
}

export function ComplianceTestingCalendar() {
  return (
    <div className="v160-three-panel-grid">
      <section className="panel v160-panel">
        <div className="panel-header"><h4>Regulatory change pipeline</h4></div>
        <div className="v160-list-stack">
          {v160RegulatoryChangePipeline.map(item => (
            <article className="v160-list-card" key={item.id}>
              <div className="v160-card-header">
                <strong>{item.source}</strong>
                <span className="status-chip neutral">{item.status}</span>
              </div>
              <p>{item.requiredAction}</p>
              <small>{item.changeType} · {item.impactArea} · {item.targetDate}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="panel v160-panel">
        <div className="panel-header"><h4>Compliance testing calendar</h4></div>
        <div className="v160-list-stack">
          {v160ComplianceTestingCalendar.map(item => (
            <article className="v160-list-card" key={item.id}>
              <div className="v160-card-header">
                <strong>{item.test}</strong>
                <span className={`status-chip ${resultClass(item.result)}`}>{item.result}</span>
              </div>
              <p>{item.evidence}</p>
              <small>{item.scope} · {item.frequency}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="panel v160-panel">
        <div className="panel-header"><h4>Policy attestation tracker</h4></div>
        <div className="v160-list-stack">
          {v160PolicyAttestationItems.map(item => (
            <article className="v160-list-card" key={item.id}>
              <div className="v160-card-header">
                <strong>{item.policy}</strong>
                <span className="status-chip warning">{item.attestation}</span>
              </div>
              <p>{item.riskIfMissing}</p>
              <small>{item.audience} · Evidence: {item.evidence}</small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
