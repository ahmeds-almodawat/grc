export function humanize(value: string | null | undefined) {
  if (!value) return '—';
  return value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (char: string) => char.toUpperCase());
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

export function ownerName(owner?: { full_name_en: string | null; full_name_ar: string | null } | null) {
  return owner?.full_name_en || owner?.full_name_ar || 'Unassigned';
}

export function departmentName(department?: { name_en: string | null; name_ar: string | null } | null) {
  return department?.name_en || department?.name_ar || 'Company-wide';
}
