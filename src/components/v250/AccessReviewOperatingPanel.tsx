import '../../styles/v250-live-grc-operating.css';
import { v250AccessReviewItems, type V250ReadinessState } from '../../lib/v250LiveGrcOperatingModel';

function stateLabel(state: V250ReadinessState) {
  return state.replace(/_/g, ' ');
}

export function AccessReviewOperatingPanel() {
  return (
    <section className="v250-panel v250-access-review" aria-label="v25 access review operating panel">
      <div className="v250-panel-heading compact">
        <p className="eyebrow">Access review and SoD operation</p>
        <h3>Production reliance requires privilege review evidence</h3>
        <p>
          The next professional maturity step is not more screens; it is periodic evidence that privileged users, owners,
          auditors and external reviewers cannot approve or close their own work without independent review.
        </p>
      </div>

      <div className="v250-access-grid">
        {v250AccessReviewItems.map(item => (
          <article className={`v250-access-card ${item.status}`} key={item.role}>
            <div className="v250-card-topline"><span>{item.reviewCadence}</span><b>{stateLabel(item.status)}</b></div>
            <h4>{item.role}</h4>
            <p>{item.segregationRule}</p>
            <small>Evidence: {item.evidenceRequired}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
