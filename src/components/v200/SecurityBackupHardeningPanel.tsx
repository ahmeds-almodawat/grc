import { v200HardeningControls } from '../../lib/v200ProductionReadinessModel';
import '../../styles/v200-production-readiness.css';

interface SecurityBackupHardeningPanelProps {
  context?: 'security' | 'proof' | 'release';
}

export function SecurityBackupHardeningPanel({ context = 'security' }: SecurityBackupHardeningPanelProps) {
  return (
    <section className={`v200-panel v200-hardening-panel ${context}`}>
      <div className="v200-panel-header compact">
        <div>
          <p className="v200-eyebrow">v20.0 security and resilience</p>
          <h3>Security, RLS, backup and confidentiality hardening</h3>
          <p>These controls convert proof scripts into production-start decision evidence.</p>
        </div>
      </div>
      <div className="v200-hardening-list">
        {v200HardeningControls.map(control => (
          <article className={`v200-hardening-card ${control.status.replace('_', '-')}`} key={control.id}>
            <span>{control.area}</span>
            <strong>{control.control}</strong>
            <p>{control.closureRule}</p>
            <small>{control.status.replaceAll('_', ' ')}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
