import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  direction?: 'ltr' | 'rtl';
  headerDescription?: ReactNode;
  size?: 'small' | 'medium' | 'large' | 'xl' | 'workspace';
  footer?: ReactNode;
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
  size = 'medium',
  footer,
}: ModalProps) {
  const i18n = useI18n();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    };
  }, [open]);

  if (!open) return null;
  const resolvedCloseLabel = closeLabel ?? i18n.t('common.close');
  const resolvedDirection = direction ?? i18n.direction;

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter(element => !element.hasAttribute('hidden'));
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className={`modal-card modal-card--${size} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-modal-size={size}
        dir={resolvedDirection}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="modal-header">
          {headerDescription ? (
            <div className="modal-header-copy">
              <h4 id={titleId}>{title}</h4>
              <div className="modal-header-description">{headerDescription}</div>
            </div>
          ) : (
            <h4 id={titleId}>{title}</h4>
          )}
          <button
            ref={closeButtonRef}
            type="button"
            className="ghost-button"
            aria-label={resolvedCloseLabel}
            onClick={onClose}
          >
            {resolvedCloseLabel}
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
