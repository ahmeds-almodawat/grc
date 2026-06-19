import { useMemo, useState } from 'react';
import { Archive, Download, FileCheck2, Search } from 'lucide-react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { getEvidenceVaultInventory } from '../lib/enterpriseApi';
import { exportRows } from '../lib/exportUtils';
import { useI18n } from '../i18n/I18nContext';

const toneForVault = (status: string) => status === 'healthy' ? 'good' : status === 'attention' ? 'danger' : 'warning';

export function EvidenceVault() {
  const { t } = useI18n();
  const inventory = useAsyncData(getEvidenceVaultInventory, []);
  const [query, setQuery] = useState('');
  const rows = inventory.data ?? [];
  const filtered = useMemo(() => rows.filter(row => `${row.fileName} ${row.linkedArea} ${row.status} ${row.vaultStatus}`.toLowerCase().includes(query.toLowerCase())), [rows, query]);
  const stats = {
    total: rows.length,
    attention: rows.filter(row => row.vaultStatus !== 'healthy').length,
    missingVersion: rows.filter(row => row.versionCount === 0).length,
    submitted: rows.filter(row => row.status === 'submitted' || row.status === 'needs_revision').length
  };

  return (
    <section className="page-section enterprise-page">
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">{t('vault.eyebrow')}</p>
          <h3>{t('vault.title')}</h3>
          <p className="section-subtitle">{t('vault.subtitle')}</p>
        </div>
        <button className="primary-button" onClick={() => exportRows('evidence_vault_inventory', filtered as unknown as Record<string, unknown>[], 'csv')}><Download size={16} /> CSV</button>
      </div>

      <div className="stats-grid">
        <KpiTile label={t('vault.totalEvidence')} value={stats.total} />
        <KpiTile label={t('vault.needsAttention')} value={stats.attention} tone={stats.attention ? 'warning' : 'good'} />
        <KpiTile label={t('vault.missingVersion')} value={stats.missingVersion} tone={stats.missingVersion ? 'danger' : 'good'} />
        <KpiTile label={t('vault.pendingReview')} value={stats.submitted} tone={stats.submitted ? 'warning' : 'good'} />
      </div>

      <ModernCard title={t('vault.inventory')} subtitle={t('vault.inventoryHint')} action={<div className="search-mini"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('common.search')} /></div>}>
        <DataState loading={inventory.loading} error={inventory.error} empty={!filtered.length}>
          <div className="vault-grid">
            {filtered.map(item => (
              <article className={`vault-card ${item.vaultStatus}`} key={item.id}>
                <div className="vault-icon"><FileCheck2 size={22} /></div>
                <div className="vault-main">
                  <div className="vault-head"><strong>{item.fileName}</strong><StatusPill tone={toneForVault(item.vaultStatus)}>{item.vaultStatus}</StatusPill></div>
                  <p>{item.linkedArea} · {item.uploadedByName} · {new Date(item.createdAt).toLocaleDateString()}</p>
                  <div className="vault-meta"><span>{item.status}</span><span><Archive size={13} /> v{item.versionCount}</span><span>{item.fileType ?? 'file'}</span></div>
                </div>
              </article>
            ))}
          </div>
        </DataState>
      </ModernCard>
    </section>
  );
}
