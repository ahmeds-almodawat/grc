import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';

export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  danger?: boolean;
}

export function ActionMenu({ items, label = 'More actions' }: { items: ActionMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className="platform-action-menu" ref={rootRef}>
      <button
        type="button"
        className="platform-icon-button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreVertical size={17} aria-hidden="true" />
      </button>
      {open ? (
        <div className="platform-action-menu__popover" id={menuId} role="menu">
          {items.map((item) => (
            <button
              type="button"
              role="menuitem"
              className={item.danger ? 'is-danger' : ''}
              disabled={item.disabled || !item.onSelect}
              title={item.disabled || !item.onSelect ? item.disabledReason ?? 'Action unavailable' : item.label}
              onClick={() => {
                item.onSelect?.();
                setOpen(false);
              }}
              key={item.id}
            >
              {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BulkActionBar({ count, selectionLabel, children, onClear, clearLabel = 'Clear selection' }: { count: number; selectionLabel: string; children: ReactNode; onClear: () => void; clearLabel?: string }) {
  if (count <= 0) return null;
  return (
    <div className="platform-bulk-action-bar" role="toolbar" aria-label={selectionLabel}>
      <strong>{count} {selectionLabel}</strong>
      <div>{children}</div>
      <button type="button" className="platform-text-button" onClick={onClear}>{clearLabel}</button>
    </div>
  );
}
