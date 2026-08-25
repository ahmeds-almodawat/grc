import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MOBILE_TABLE_QUERY = '(max-width: 900px)';

function useMobileTableLayout() {
  const [mobile, setMobile] = useState(() => globalThis.matchMedia?.(MOBILE_TABLE_QUERY).matches ?? false);

  useEffect(() => {
    const media = globalThis.matchMedia?.(MOBILE_TABLE_QUERY);
    if (!media) return undefined;
    const update = (event: MediaQueryListEvent) => setMobile(event.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return mobile;
}

export interface ResponsiveTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  mobileLabel?: string;
  primary?: boolean;
  hideOnMobile?: boolean;
  className?: string;
}

export function ResponsiveTable<T>({
  columns,
  rows,
  getRowKey,
  ariaLabel,
  getRowClassName,
  renderMobileActions,
}: {
  columns: ResponsiveTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  ariaLabel: string;
  getRowClassName?: (row: T) => string | undefined;
  renderMobileActions?: (row: T) => ReactNode;
}) {
  const mobile = useMobileTableLayout();
  const primaryColumn = columns.find((column) => column.primary) ?? columns[0];
  const mobileColumns = columns.filter((column) => column.key !== primaryColumn?.key && !column.hideOnMobile);

  if (mobile) {
    return (
      <div className="platform-record-list" aria-label={`${ariaLabel} mobile records`}>
        {rows.map((row) => (
          <article className={`platform-record-card ${getRowClassName?.(row) ?? ''}`.trim()} key={getRowKey(row)}>
            <header>
              <strong>{primaryColumn?.render(row)}</strong>
              {renderMobileActions ? <div>{renderMobileActions(row)}</div> : null}
            </header>
            <dl>
              {mobileColumns.map((column) => (
                <div key={column.key}>
                  <dt>{column.mobileLabel ?? column.header}</dt>
                  <dd>{column.render(row)}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="platform-responsive-table" role="region" aria-label={ariaLabel} tabIndex={0}>
      <table>
        <thead>
          <tr>{columns.map((column) => <th className={column.className} key={column.key}>{column.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className={getRowClassName?.(row)} key={getRowKey(row)}>
              {columns.map((column) => <td className={column.className} key={column.key}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  label = 'Pagination',
  summary,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  label?: string;
  summary?: ReactNode;
}) {
  const visiblePages = Array.from(new Set([1, page - 1, page, page + 1, pageCount]))
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((left, right) => left - right);

  return (
    <div className="platform-pagination">
      {summary ? <span>{summary}</span> : <span />}
      <nav aria-label={label}>
        <button type="button" className="platform-icon-button directional-icon" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        {visiblePages.map((value, index) => {
          const previous = visiblePages[index - 1];
          return (
            <span className="platform-pagination__item" key={value}>
              {previous && value - previous > 1 ? <i aria-hidden="true">…</i> : null}
              <button type="button" className={value === page ? 'is-active' : ''} aria-current={value === page ? 'page' : undefined} onClick={() => onPageChange(value)}>{value}</button>
            </span>
          );
        })}
        <button type="button" className="platform-icon-button directional-icon" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}
