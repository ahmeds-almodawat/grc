import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { CalendarDays, ChevronDown, UserRound } from 'lucide-react';

export function FormField({
  label,
  required = false,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className={`platform-form-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={htmlFor}>{label}{required ? <span aria-hidden="true">*</span> : null}</label>
      {children}
      {error ? <p className="platform-form-field__error" role="alert">{error}</p> : hint ? <p className="platform-form-field__hint">{hint}</p> : null}
    </div>
  );
}

export function TextField({ label, hint, error, required, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <FormField label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      <input id={inputId} {...props} required={required} aria-invalid={Boolean(error)} />
    </FormField>
  );
}

export function SelectField({ label, hint, error, required, id, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string; children: ReactNode }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <FormField label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      <span className="platform-select-wrap">
        <select id={inputId} {...props} required={required} aria-invalid={Boolean(error)}>{children}</select>
        <ChevronDown size={15} aria-hidden="true" />
      </span>
    </FormField>
  );
}

export function DateField({ label, hint, error, required, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <FormField label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      <span className="platform-input-icon-wrap">
        <CalendarDays size={16} aria-hidden="true" />
        <input id={inputId} {...props} type="date" required={required} aria-invalid={Boolean(error)} />
      </span>
    </FormField>
  );
}

export function UserSelector({ label, value, detail, onClick, disabled = false, disabledReason }: { label: string; value?: string; detail?: string; onClick?: () => void; disabled?: boolean; disabledReason?: string }) {
  return (
    <div className="platform-form-field">
      <span className="platform-form-field__label">{label}</span>
      <button type="button" className="platform-user-selector" onClick={onClick} disabled={disabled || !onClick} title={disabled || !onClick ? disabledReason ?? 'User selection unavailable' : label}>
        <span aria-hidden="true"><UserRound size={17} /></span>
        <span><strong>{value ?? 'Select user'}</strong>{detail ? <small>{detail}</small> : null}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
