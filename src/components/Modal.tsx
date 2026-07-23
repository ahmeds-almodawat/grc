import type { ReactNode } from 'react';
import { useI18n } from '../i18n/I18nContext';

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  direction?: 'ltr' | 'rtl';
  headerDescription?: ReactNode;
}

export function Modal({
  title,
  open,
  onClose,
  children,
  className = '',
  closeLabel,
  direction,
  headerDescription,
}: ModalProps) {
  const i18n = useI18n();
  if (!open) return null;
  const resolvedCloseLabel = closeLabel ?? i18n.t('common.close');
  const resolvedDirection = direction ?? i18n.direction;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className={`modal-card ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        dir={resolvedDirection}
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="modal-header">
          {headerDescription ? (
            <div className="modal-header-copy">
              <h4>{title}</h4>
              <div className="modal-header-description">{headerDescription}</div>
            </div>
          ) : (
            <h4>{title}</h4>
          )}
          <button
            type="button"
            className="ghost-button"
            aria-label={resolvedCloseLabel}
            onClick={onClose}
          >
            {resolvedCloseLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
