import { v180AssuranceMap, v180RatingClass } from '../../lib/v180GrcTraceabilityModel';
import '../../styles/v180-grc-traceability.css';

export function AssuranceMapPanel() {
  return (
    <section className="panel v180-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Assurance map</p>
          <h4>First, second and third line coverage</h4>
          <p>Shows whether high-risk areas are owned, monitored, independently reviewed and ready for executive reporting.</p>
        </div>
      </div>

      <div className="v180-assurance-table">
        <div className="v180-assurance-head">
          <span>Area</span>
          <span>Risk theme</span>
          <span>1st line</span>
          <span>2nd line</span>
          <span>3rd line</span>
          <span>Executive signal</span>
        </div>
        {v180AssuranceMap.map((row) => (
          <article className="v180-assurance-row" key={row.area}>
            <span><strong>{row.area}</strong><small>{row.nextAction}</small></span>
            <span>{row.riskTheme}</span>
            <span className={`v180-rating ${v180RatingClass(row.firstLine)}`}>{row.firstLine}</span>
            <span className={`v180-rating ${v180RatingClass(row.secondLine)}`}>{row.secondLine}</span>
            <span className={`v180-rating ${v180RatingClass(row.thirdLine)}`}>{row.thirdLine}</span>
            <span className={`v180-rating ${v180RatingClass(row.executiveSignal)}`}>{row.executiveSignal}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
