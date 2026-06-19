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
    const raw = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
    return raw;
  };

  return [columns.join(','), ...rows.map((row) => columns.map((column) => escape(row[column])).join(','))].join('\n');
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
  URL.revokeObjectURL(url);
}

export function exportRows(fileBaseName: string, rows: Record<string, unknown>[], format: 'csv' | 'json') {
  const safeName = fileBaseName.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (format === 'json') {
    downloadTextFile(`${safeName}_${timestamp}.json`, JSON.stringify(rows, null, 2), 'application/json;charset=utf-8');
    return `${safeName}_${timestamp}.json`;
  }

  downloadTextFile(`${safeName}_${timestamp}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
  return `${safeName}_${timestamp}.csv`;
}

export function printRows(title: string, rows: Record<string, unknown>[], direction: 'ltr' | 'rtl' = 'ltr') {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const htmlRows = rows
    .slice(0, 500)
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => `<td>${escapeHtml(formatCell(row[column]))}</td>`)
          .join('')}</tr>`
    )
    .join('');

  const html = `<!doctype html>
<html dir="${direction}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; margin: 24px; color: #0f172a; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .meta { color: #64748b; font-size: 12px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f1f5f9; text-align: start; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Generated: ${new Date().toLocaleString()} · Rows: ${rows.length}</div>
  <table>
    <thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
    <tbody>${htmlRows}</tbody>
  </table>
</body>
</html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
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
