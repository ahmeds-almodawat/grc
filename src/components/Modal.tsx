import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export type ModalCloseReason = 'backdrop' | 'escape' | 'close-button';

export interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  onRequestClose?: (reason: ModalCloseReason) => void;
  isDirty?: boolean;
  isSubmitting?: boolean;
  discardPromptTitle?: string;
  discardPromptMessage?: string;
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
  onRequestClose,
  isDirty = false,
  isSubmitting = false,
  discardPromptTitle,
  discardPromptMessage,
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
  const discardTitleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const discardButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const mouseDownOnBackdropRef = useRef(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      setShowDiscardConfirm(false);
      return undefined;
    }
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

  useEffect(() => {
    if (showDiscardConfirm) {
      const frame = window.requestAnimationFrame(() => discardButtonRef.current?.focus());
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [showDiscardConfirm]);

  if (!open) return null;
  const resolvedCloseLabel = closeLabel ?? i18n.t('common.close');
  const resolvedDirection = direction ?? i18n.direction;

  const handleRequestClose = (reason: ModalCloseReason) => {
    if (isSubmitting) {
      return;
    }
    if (onRequestClose) {
      onRequestClose(reason);
      return;
    }
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (showDiscardConfirm) {
        setShowDiscardConfirm(false);
      } else {
        handleRequestClose('escape');
      }
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusRoot = showDiscardConfirm
      ? dialogRef.current.querySelector<HTMLElement>('.modal-discard-card') ?? dialogRef.current
      : dialogRef.current;
    const focusable = Array.from(focusRoot.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter(element => !element.hasAttribute('hidden'));
    if (focusable.length === 0) {
      event.preventDefault();
      focusRoot.focus();
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

  const handleBackdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    mouseDownOnBackdropRef.current = event.target === event.currentTarget;
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (mouseDownOnBackdropRef.current && event.target === event.currentTarget) {
      handleRequestClose('backdrop');
    }
    mouseDownOnBackdropRef.current = false;
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
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
        onClick={event => event.stopPropagation()}
        style={{ position: 'relative' }}
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
            disabled={isSubmitting}
            onClick={() => handleRequestClose('close-button')}
          >
            {resolvedCloseLabel}
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}

        {showDiscardConfirm ? (
          <div
            className="modal-discard-overlay"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={discardTitleId}
          >
            <div className="modal-discard-card" dir={resolvedDirection}>
              <h5 id={discardTitleId}>
                {discardPromptTitle ?? i18n.t('modal.discardTitle', 'Discard unsaved changes?')}
              </h5>
              <p>
                {discardPromptMessage ?? i18n.t('modal.discardMessage', 'You have unsubmitted changes. If you close now, your draft will be discarded.')}
              </p>
              <div className="modal-discard-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setShowDiscardConfirm(false)}
                >
                  {i18n.t('modal.keepEditing', 'Keep editing')}
                </button>
                <button
                  ref={discardButtonRef}
                  type="button"
                  className="danger-button"
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    onClose();
                  }}
                >
                  {i18n.t('modal.discardChanges', 'Discard changes')}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
