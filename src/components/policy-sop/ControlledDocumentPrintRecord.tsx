import { useI18n } from '../../i18n/I18nContext';

interface ControlledDocumentPrintRecordProps {
  versionLabel: string | null;
  versionNumber: number | null;
  isCurrentVersion: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  signOffRequired?: boolean;
}

function PrintRecordField({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong data-testid={testId}>{value}</strong>
    </div>
  );
}

export function ControlledDocumentPrintRecord({
  versionLabel,
  versionNumber,
  isCurrentVersion,
  approvedBy,
  approvedAt,
  signOffRequired,
}: ControlledDocumentPrintRecordProps) {
  const { t } = useI18n();
  const notRecorded = t('controlledPrint.notRecorded');

  return (
    <section className="controlled-document-print-record governed-print-break-safe" aria-label={t('controlledPrint.record')}>
      <PrintRecordField label={t('controlledPrint.versionLabel')} value={versionLabel || notRecorded} testId="controlled-version-label" />
      <PrintRecordField label={t('controlledPrint.versionNumber')} value={versionNumber === null ? notRecorded : String(versionNumber)} />
      <PrintRecordField label={t('controlledPrint.currentVersion')} value={isCurrentVersion ? t('common.yes') : t('common.no')} />
      <PrintRecordField label={t('controlledPrint.approvalStatus')} value={approvedAt ? t('controlledPrint.approvalRecorded') : t('controlledPrint.noApprovalRecorded')} />
      <PrintRecordField label={t('controlledPrint.approvedAt')} value={approvedAt || notRecorded} />
      <PrintRecordField label={t('controlledPrint.approverReference')} value={approvedBy || notRecorded} />
      {signOffRequired !== undefined ? (
        <>
          <PrintRecordField label={t('controlledPrint.signOffRequirement')} value={signOffRequired ? t('controlledPrint.required') : t('controlledPrint.notRequired')} />
          <PrintRecordField label={t('controlledPrint.signOffStatus')} value={t('controlledPrint.signOffNotIncluded')} />
        </>
      ) : null}
    </section>
  );
}
