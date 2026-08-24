import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from './Modal';
import { useI18n } from '../i18n/I18nContext';

export interface DecisionContextItem {
  label: string;
  value: React.ReactNode;
}

export interface DecisionFieldConfig {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select';
  placeholder?: string;
  defaultValue?: string | number;
  required?: boolean;
  min?: number | string;
  max?: number | string;
  step?: number;
  options?: Array<{ value: string; label: string }>;
  hint?: string;
  autoFocus?: boolean;
}

export interface GovernedDecisionDialogProps {
  open: boolean;
  title: string;
  subtitle?: string;
  decisionVariant?: 'approve' | 'reject' | 'action' | 'warning' | 'danger';
  confirmLabel?: string;
  cancelLabel?: string;
  contextItems?: DecisionContextItem[];
  fields?: DecisionFieldConfig[];
  children?: React.ReactNode;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  error?: string | null;
  warningNotice?: string | null;
  size?: 'small' | 'medium' | 'large';
  onClose: () => void;
  onSubmit: (values: Record<string, any>) => Promise<void> | void;
}

export function GovernedDecisionDialog({
  open,
  title,
  subtitle,
  decisionVariant = 'action',
  confirmLabel,
  cancelLabel,
  contextItems = [],
  fields = [],
  children,
  isSubmitting: externalSubmitting = false,
  submitDisabled = false,
  error = null,
  warningNotice = null,
  size = 'medium',
  onClose,
  onSubmit,
}: GovernedDecisionDialogProps) {
  const { t } = useI18n();

  const initialValuesSignature = JSON.stringify(
    fields.map((field) => [field.id, field.defaultValue !== undefined ? field.defaultValue : '']),
  );
  const initialValues = useMemo<Record<string, any>>(
    () => Object.fromEntries(JSON.parse(initialValuesSignature) as Array<[string, string | number]>),
    [initialValuesSignature],
  );

  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setInternalSubmitting(false);
      setLocalError(null);
      isSubmittingRef.current = false;
    }
  }, [open, initialValues]);

  const isDirty = useMemo(() => {
    return fields.some(f => {
      const initial = initialValues[f.id] ?? '';
      const current = values[f.id] ?? '';
      return String(initial) !== String(current);
    });
  }, [fields, initialValues, values]);

  const handleFieldChange = (fieldId: string, value: any) => {
    setValues(prev => ({ ...prev, [fieldId]: value }));
    setLocalError(null);
  };

  const isSubmitting = externalSubmitting || internalSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSubmitting) return;

    for (const f of fields) {
      if (f.required) {
        const val = values[f.id];
        if (val === undefined || val === null || String(val).trim() === '') {
          setLocalError(`${f.label}: ${t('decision.requiredField')}`);
          return;
        }
      }
      if (f.type === 'number') {
        const num = Number(values[f.id]);
        if (f.min !== undefined && num < Number(f.min)) {
          setLocalError(`${f.label} must be at least ${f.min}.`);
          return;
        }
        if (f.max !== undefined && num > Number(f.max)) {
          setLocalError(`${f.label} cannot exceed ${f.max}.`);
          return;
        }
      }
    }

    isSubmittingRef.current = true;
    setInternalSubmitting(true);
    setLocalError(null);

    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t('decision.actionFailed'));
    } finally {
      isSubmittingRef.current = false;
      setInternalSubmitting(false);
    }
  };

  const confirmBtnClass =
    decisionVariant === 'reject' || decisionVariant === 'danger'
      ? 'primary-button danger'
      : decisionVariant === 'approve'
      ? 'primary-button success'
      : 'primary-button';

  return (
    <Modal
      open={open}
      title={title}
      size={size}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate className="governed-decision-form">
        {subtitle ? <p className="muted" style={{ marginTop: '-4px', marginBottom: '16px' }}>{subtitle}</p> : null}

        {error || localError ? (
          <div className="panel error-panel" style={{ marginBottom: '16px' }}>
            {error || localError}
          </div>
        ) : null}

        {warningNotice ? (
          <div className="notice-banner warning" style={{ marginBottom: '16px' }}>
            {warningNotice}
          </div>
        ) : null}

        {contextItems.length > 0 ? (
          <div className="detail-grid" style={{ marginBottom: '16px', backgroundColor: 'var(--bg-subtle, rgba(255,255,255,0.03))', padding: '12px', borderRadius: '8px' }}>
            {contextItems.map((item, idx) => (
              <div key={idx}>
                <span>{item.label}</span>
                <strong>{item.value || '—'}</strong>
              </div>
            ))}
          </div>
        ) : null}

        {children}

        {fields.map(f => {
          const inputId = `decision-field-${f.id}`;
          const currentVal = values[f.id] ?? '';

          return (
            <div key={f.id} className="field-group" style={{ marginBottom: '16px' }}>
              <label htmlFor={inputId}>
                {f.label} {f.required ? '*' : ''}
              </label>

              {f.type === 'textarea' ? (
                <textarea
                  id={inputId}
                  name={f.id}
                  value={currentVal}
                  placeholder={f.placeholder}
                  required={f.required}
                  autoFocus={f.autoFocus}
                  disabled={isSubmitting}
                  onChange={e => handleFieldChange(f.id, e.target.value)}
                />
              ) : f.type === 'select' ? (
                <select
                  id={inputId}
                  name={f.id}
                  value={currentVal}
                  required={f.required}
                  autoFocus={f.autoFocus}
                  disabled={isSubmitting}
                  onChange={e => handleFieldChange(f.id, e.target.value)}
                >
                  {f.options?.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : f.type === 'number' ? (
                <input
                  type="number"
                  id={inputId}
                  name={f.id}
                  value={currentVal}
                  placeholder={f.placeholder}
                  min={f.min}
                  max={f.max}
                  step={f.step ?? 1}
                  required={f.required}
                  autoFocus={f.autoFocus}
                  disabled={isSubmitting}
                  onChange={e => handleFieldChange(f.id, e.target.value === '' ? '' : Number(e.target.value))}
                />
              ) : f.type === 'date' ? (
                <input
                  type="date"
                  id={inputId}
                  name={f.id}
                  value={currentVal}
                  placeholder={f.placeholder}
                  min={f.min}
                  max={f.max}
                  required={f.required}
                  autoFocus={f.autoFocus}
                  disabled={isSubmitting}
                  onChange={e => handleFieldChange(f.id, e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  id={inputId}
                  name={f.id}
                  value={currentVal}
                  placeholder={f.placeholder}
                  required={f.required}
                  autoFocus={f.autoFocus}
                  disabled={isSubmitting}
                  onChange={e => handleFieldChange(f.id, e.target.value)}
                />
              )}

              {f.hint ? <small className="muted">{f.hint}</small> : null}
            </div>
          );
        })}

        <div className="form-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button
            type="button"
            className="ghost-button"
            disabled={isSubmitting}
            onClick={onClose}
          >
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            type="submit"
            className={confirmBtnClass}
            disabled={isSubmitting || submitDisabled}
          >
            {isSubmitting
              ? t('decision.submitting')
              : confirmLabel || t('decision.confirm')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
