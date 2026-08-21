export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );

  const escape = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const source = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const raw = typeof value === 'string' && /^[\t ]*[=+@-]/.test(source) ? `'${source}` : source;
    if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
    return raw;
  };

  return [columns.join(','), ...rows.map((row) => columns.map((column) => escape(row[column])).join(','))].join('\r\n');
}

export function normalizeExportFileBaseName(fileBaseName: string): string {
  return fileBaseName
    .normalize('NFKC')
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .toLocaleLowerCase() || 'grc-export';
}

export function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportRows(fileBaseName: string, rows: Record<string, unknown>[], format: 'csv' | 'json') {
  const safeName = normalizeExportFileBaseName(fileBaseName);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (format === 'json') {
    downloadTextFile(`${safeName}_${timestamp}.json`, JSON.stringify(rows, null, 2), 'application/json;charset=utf-8');
    return `${safeName}_${timestamp}.json`;
  }

  downloadTextFile(`${safeName}_${timestamp}.csv`, `\uFEFF${toCsv(rows)}`, 'text/csv;charset=utf-8');
  return `${safeName}_${timestamp}.csv`;
}

export function buildPrintDocument(
  title: string,
  rows: Record<string, unknown>[],
  direction: 'ltr' | 'rtl' = 'ltr',
  generatedAt = new Date(),
) {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const locale = direction === 'rtl' ? 'ar-SA' : 'en-GB';
  const labels = direction === 'rtl'
    ? { generated: 'تاريخ الإنشاء', rows: 'عدد السجلات', limited: 'تم تحديد النسخة المطبوعة إلى أول 500 سجل.' }
    : { generated: 'Generated', rows: 'Rows', limited: 'Print output is limited to the first 500 rows.' };
  const htmlRows = rows
    .slice(0, 500)
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => `<td>${escapeHtml(formatCell(row[column]))}</td>`)
          .join('')}</tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="${direction === 'rtl' ? 'ar' : 'en'}" dir="${direction}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    body { font-family: ${direction === 'rtl' ? 'Tahoma, Arial' : 'Inter, Arial'}, sans-serif; margin: 0; color: #0f172a; font-size: 10pt; line-height: 1.45; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .meta { color: #64748b; font-size: 12px; margin-bottom: 20px; }
    .limit { color: #9f1239; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f1f5f9; text-align: start; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    thead { display: table-header-group; }
    tr, th, td { break-inside: avoid-page; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${labels.generated}: ${escapeHtml(new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(generatedAt))} · ${labels.rows}: ${rows.length}</div>
  ${rows.length > 500 ? `<p class="limit">${labels.limited}</p>` : ''}
  <table>
    <thead><tr>${columns.map((column) => `<th>${escapeHtml(formatColumnLabel(column))}</th>`).join('')}</tr></thead>
    <tbody>${htmlRows}</tbody>
  </table>
</body>
</html>`;
}

export function printRows(title: string, rows: Record<string, unknown>[], direction: 'ltr' | 'rtl' = 'ltr') {
  const html = buildPrintDocument(title, rows, direction);

  const win = window.open('', '_blank');
  if (!win) return;
  win.opener = null;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

function formatColumnLabel(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
