import {
  v150AnnualAuditPlan,
  v150AuditUniverse,
  v150EvidenceRequests,
  v150WorkpaperChecklist,
} from '../../lib/v150AuditProgramModel';
import '../../styles/v150-audit-program.css';

function stateClass(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function AuditEngagementChecklist() {
  return (
    <section className="v150-panel" aria-label="Audit universe and engagement execution checklist">
      <div className="v150-panel-header v150-panel-header--split">
        <div>
          <span className="v150-eyebrow">Audit universe and plan</span>
          <h3>Risk-based audit execution workspace</h3>
          <p>
            Sample controlled-pilot structure for audit universe, annual plan, workpaper index and evidence requests.
            It is workflow scaffolding only; it does not claim real audit results.
          </p>
        </div>
        <div className="v150-score-card">
          <span>Execution depth</span>
          <strong>Program-ready</strong>
          <small>Frontend workflow layer, no new migration</small>
        </div>
      </div>

      <div className="v150-subpanel">
        <div className="v150-subpanel-header">
          <h4>Audit Universe</h4>
          <span>Auditable area • risk rating • owner • coverage</span>
        </div>
        <div className="v150-table-grid v150-table-grid--universe">
          <strong>Auditable area</strong>
          <strong>Risk</strong>
          <strong>Owner</strong>
          <strong>Last audit</strong>
          <strong>Next audit</strong>
          <strong>Coverage</strong>
          {v150AuditUniverse.map((item) => (
            <div className="v150-grid-row" key={item.id}>
              <span>{item.auditableArea}</span>
              <em className={`v150-pill ${stateClass(item.riskRating)}`}>{item.riskRating}</em>
              <span>{item.owner}</span>
              <span>{item.lastAudit}</span>
              <span>{item.nextPlannedAudit}</span>
              <em className={`v150-pill ${stateClass(item.assuranceCoverage)}`}>{item.assuranceCoverage}</em>
            </div>
          ))}
        </div>
      </div>

      <div className="v150-two-column">
        <div className="v150-subpanel">
          <div className="v150-subpanel-header">
            <h4>Annual Audit Plan</h4>
            <span>Engagement priority by quarter</span>
          </div>
          <div className="v150-card-list">
            {v150AnnualAuditPlan.map((item) => (
              <article className="v150-mini-card" key={item.id}>
                <div>
                  <strong>{item.engagement}</strong>
                  <p>{item.auditOwner}</p>
                </div>
                <span>{item.quarter}</span>
                <em className={`v150-pill ${stateClass(item.status)}`}>{item.status}</em>
              </article>
            ))}
          </div>
        </div>

        <div className="v150-subpanel">
          <div className="v150-subpanel-header">
            <h4>Evidence Request Tracker</h4>
            <span>Request owner, due date and blocker flag</span>
          </div>
          <div className="v150-card-list">
            {v150EvidenceRequests.map((item) => (
              <article className="v150-mini-card" key={item.id}>
                <div>
                  <strong>{item.request}</strong>
                  <p>{item.ownerDepartment} • due {item.dueDate}</p>
                </div>
                <em className={`v150-pill ${stateClass(item.status)}`}>{item.status}</em>
                {item.blockerFlag ? <span className="v150-blocker">Blocker</span> : null}
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="v150-subpanel">
        <div className="v150-subpanel-header">
          <h4>Workpaper checklist</h4>
          <span>Planning memo, risk/control matrix, procedures, evidence and reviewer sign-off</span>
        </div>
        <div className="v150-workpaper-grid">
          {v150WorkpaperChecklist.map((item) => (
            <article className="v150-workpaper" key={item.id}>
              <span>{item.status}</span>
              <h5>{item.title}</h5>
              <p>{item.purpose}</p>
              <small>{item.requiredEvidence}</small>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
