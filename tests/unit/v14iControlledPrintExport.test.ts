import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPrintDocument, normalizeExportFileBaseName, toCsv } from '../../src/lib/exportUtils';

const root = process.cwd();
const source = (file: string) => readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');

describe('GRC v1.4-I controlled print and export contracts', () => {
  it('normalizes UTF-8 CSV output and neutralizes spreadsheet formulas', () => {
    const csv = toCsv([
      { title: 'بلاغ عربي', amount: -7, note: '=HYPERLINK("https://example.test")' },
      { title: 'line\nbreak', amount: 3, note: 'safe' },
    ]);

    expect(csv).toContain('\r\n');
    expect(csv).toContain('-7');
    expect(csv).toContain('"\'=HYPERLINK(""https://example.test"")"');
    expect(csv).toContain('"line\nbreak"');
  });

  it('keeps meaningful Arabic filenames and supplies a deterministic fallback', () => {
    expect(normalizeExportFileBaseName(' حزمة الأدلة / أغسطس 2026 ')).toBe('حزمة_الأدلة_أغسطس_2026');
    expect(normalizeExportFileBaseName('***')).toBe('grc-export');
  });

  it('builds isolated A4 documents with RTL metadata and controlled row limits', () => {
    const rows = Array.from({ length: 501 }, (_, index) => ({ record_id: index + 1 }));
    const html = buildPrintDocument('<حزمة محكومة>', rows, 'rtl', new Date('2026-08-21T00:00:00.000Z'));

    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain('@page { size: A4 portrait; margin: 14mm; }');
    expect(html).toContain('&lt;حزمة محكومة&gt;');
    expect(html).toContain('عدد السجلات: 501');
    expect(html).toContain('تم تحديد النسخة المطبوعة إلى أول 500 سجل.');
    expect(html.match(/<tbody>[\s\S]*<tr>/g)?.length).toBe(1);
    expect((html.match(/<tr>/g) ?? []).length).toBe(501);
    expect(html).not.toContain('<button');
  });

  it('registers only explicit active governed roots for OVR, evidence, Policy, and SOP print', () => {
    for (const file of [
      'src/components/OvrPrintableReport.tsx',
      'src/pages/Evidence.tsx',
      'src/components/policy-sop/PolicyPreviewModal.tsx',
      'src/components/policy-sop/SopPreviewModal.tsx',
    ]) {
      const contents = source(file);
      expect(contents, file).toContain('governed-print-root');
      expect(contents, file).toContain('data-print-active="true"');
    }

    const styles = source('src/styles.css');
    expect(styles).toContain('.governed-print-root[data-print-active="true"]');
    expect(styles).toContain('break-inside: avoid-page');
    expect(styles).toContain('table-layout: fixed');
  });

  it('prints exact governed versions and truthful approval and sign-off provenance', () => {
    const badge = source('src/components/policy-sop/DocumentVersionBadge.tsx');
    const record = source('src/components/policy-sop/ControlledDocumentPrintRecord.tsx');
    const policy = source('src/components/policy-sop/PolicyPreviewModal.tsx');
    const sop = source('src/components/policy-sop/SopPreviewModal.tsx');

    expect(badge).not.toContain("'v1.0'");
    expect(record).toContain('versionLabel || notRecorded');
    expect(record).toContain("approvedAt ? t('controlledPrint.approvalRecorded') : t('controlledPrint.noApprovalRecorded')");
    expect(record).toContain("t('controlledPrint.signOffNotIncluded')");
    expect(policy).toContain('versionNumber={policy.version_number}');
    expect(policy).toContain('approvedAt={policy.approved_at}');
    expect(sop).toContain('versionNumber={sop.version_number}');
    expect(sop).toContain('signOffRequired={sop.acknowledgment_required}');
    expect(sop).not.toContain("primary_policy_version_label || '1.0'");
  });
});
