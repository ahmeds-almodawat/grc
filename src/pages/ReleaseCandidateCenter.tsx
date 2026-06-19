import { Download, Rocket } from 'lucide-react';
import { DataState } from '../components/DataState';
import { StatusBadge } from '../components/StatusBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { getMigrationSteps, getReleaseGates } from '../lib/commandCenterApi';
import { useI18n } from '../i18n/I18nContext';

function exportCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(row => headers.map(header => JSON.stringify(row[header] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReleaseCandidateCenter() {
  const { t } = useI18n();
  const gates = useAsyncData(getReleaseGates, []);
  const migrations = useAsyncData(getMigrationSteps, []);
  const blockerCount = (gates.data ?? []).filter(gate => gate.status === 'blocked').length;
  const warningCount = (gates.data ?? []).filter(gate => gate.status === 'warning').length;

  return (
    <section className="page-section release-page">
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">{t('release.eyebrow')}</p>
          <h3>{t('release.title')}</h3>
          <p className="section-subtitle">{t('release.subtitle')}</p>
        </div>
        <button className="primary-button" onClick={() => exportCsv('release-candidate-gates.csv', gates.data as any[] ?? [])}><Download size={16} /> {t('release.exportGates')}</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card danger"><Rocket size={20} /><div className="stat-value">{blockerCount}</div><div className="stat-label">{t('release.blockers')}</div></div>
        <div className="stat-card warning"><Rocket size={20} /><div className="stat-value">{warningCount}</div><div className="stat-label">{t('release.warnings')}</div></div>
        <div className="stat-card success"><Rocket size={20} /><div className="stat-value">{Math.max(0, 100 - blockerCount * 25 - warningCount * 8)}%</div><div className="stat-label">{t('release.readiness')}</div></div>
      </div>

      <div className="two-column align-start">
        <div className="panel">
          <div className="panel-header"><h4>{t('release.gates')}</h4><p>{t('release.gatesHint')}</p></div>
          <DataState loading={gates.loading} error={gates.error} empty={!gates.data?.length}>
            <div className="warning-stack">
              {(gates.data ?? []).map(gate => (
                <div className={`warning-card release-gate ${gate.status}`} key={gate.id}>
                  <div className="split-header"><strong>{gate.gateName}</strong><StatusBadge status={gate.status} /></div>
                  <p>{gate.notes}</p>
                  <div className="command-meta"><span>{gate.gateArea}</span><span>{gate.owner}</span><span>{gate.evidenceRequired ? t('common.requiredEvidence') : t('common.no')}</span></div>
                </div>
              ))}
            </div>
          </DataState>
        </div>

        <div className="panel">
          <div className="panel-header"><h4>{t('release.migrationOrder')}</h4><p>{t('release.migrationHint')}</p></div>
          <DataState loading={migrations.loading} error={migrations.error} empty={!migrations.data?.length}>
            <div className="migration-list">
              {(migrations.data ?? []).map(step => (
                <div className="migration-step" key={step.migrationFile}>
                  <span>{step.sequenceNo}</span>
                  <div><strong>{step.migrationFile}</strong><p className="muted">{step.purpose}</p></div>
                </div>
              ))}
            </div>
          </DataState>
        </div>
      </div>
    </section>
  );
}
