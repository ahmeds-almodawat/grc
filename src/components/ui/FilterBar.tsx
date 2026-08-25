import { useId, useState, type ReactNode } from 'react';
import { Download, Filter, Search, SlidersHorizontal, X } from 'lucide-react';

export function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  label: string;
  disabled?: boolean;
}) {
  const inputId = useId();
  return (
    <form
      className="platform-search-field"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <Search size={16} aria-hidden="true" />
      <label className="sr-only" htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      {value ? (
        <button type="button" className="platform-icon-button" onClick={() => onChange('')} aria-label="Clear search" title="Clear search">
          <X size={15} aria-hidden="true" />
        </button>
      ) : null}
    </form>
  );
}

export function FilterBar({
  children,
  advanced,
  activeCount = 0,
  onReset,
  resetLabel = 'Reset',
  advancedLabel = 'Advanced filters',
}: {
  children: ReactNode;
  advanced?: ReactNode;
  activeCount?: number;
  onReset?: () => void;
  resetLabel?: string;
  advancedLabel?: string;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  return (
    <section className="platform-filter-bar" aria-label="Filters">
      <div className="platform-filter-bar__main">
        <span className="platform-filter-bar__marker" aria-hidden="true"><Filter size={16} /></span>
        <div className="platform-filter-bar__controls">{children}</div>
        {advanced ? (
          <button
            type="button"
            className={`platform-filter-toggle ${advancedOpen ? 'is-active' : ''}`}
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((value) => !value)}
          >
            <SlidersHorizontal size={15} aria-hidden="true" />
            <span>{advancedLabel}</span>
            {activeCount > 0 ? <strong>{activeCount}</strong> : null}
          </button>
        ) : null}
        {onReset ? <button type="button" className="platform-text-button" onClick={onReset}>{resetLabel}</button> : null}
      </div>
      {advancedOpen && advanced ? <div className="platform-filter-bar__advanced">{advanced}</div> : null}
    </section>
  );
}

export function ExportAction({
  label = 'Export',
  onExport,
  disabled = false,
  disabledReason,
}: {
  label?: string;
  onExport?: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      className="platform-secondary-button"
      onClick={onExport}
      disabled={disabled || !onExport}
      title={disabled || !onExport ? disabledReason ?? 'Export is not available for this view' : label}
    >
      <Download size={15} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
