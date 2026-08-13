import { useState } from 'react';
import { Download, Eye, FileText, Info } from 'lucide-react';
import { requestGovernedEvidenceAccess } from '../lib/grcApi';
import { useI18n } from '../i18n/I18nContext';

interface GovernedEvidenceAccessProps {
  evidenceId: string;
  fileName: string;
  fileType?: string | null;
  fileSize?: number | null;
  description?: string | null;
}

function formatBytes(value: number | null | undefined, unavailable: string) {
  if (!value) return unavailable;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function GovernedEvidenceAccess({ evidenceId, fileName, fileType, fileSize, description }: GovernedEvidenceAccessProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<'view' | 'download' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState(false);

  async function open(intent: 'view' | 'download') {
    setBusy(intent);
    setError(null);
    try {
      const result = await requestGovernedEvidenceAccess(evidenceId, intent);
      const link = document.createElement('a');
      link.href = result.signed_url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      if (intent === 'download') link.download = result.file_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('evidenceAccess.failed'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="governed-evidence-file">
      <span className="governed-evidence-file__name"><FileText size={15} /> {fileName}</span>
      <div className="inline-actions">
        <button className="ghost-button compact-button" type="button" disabled={Boolean(busy)} onClick={() => void open('view')}><Eye size={14} /> {busy === 'view' ? t('evidenceAccess.opening') : t('evidenceAccess.view')}</button>
        <button className="ghost-button compact-button" type="button" disabled={Boolean(busy)} onClick={() => void open('download')}><Download size={14} /> {busy === 'download' ? t('evidenceAccess.preparing') : t('evidenceAccess.download')}</button>
        <button className="ghost-button compact-button" type="button" onClick={() => setDetails(value => !value)} aria-expanded={details}><Info size={14} /> {t('evidenceAccess.details')}</button>
      </div>
      {details ? <div className="governed-evidence-file__details"><span>{fileType || t('evidenceAccess.unknownType')}</span><span>{formatBytes(fileSize, t('evidenceAccess.sizeUnavailable'))}</span>{description ? <span>{description}</span> : null}<small>{t('evidenceAccess.privateExpiry', 'Private access is authorized per evidence record and expires after 60 seconds.')}</small></div> : null}
      {error ? <div className="form-error">{error}</div> : null}
    </div>
  );
}
