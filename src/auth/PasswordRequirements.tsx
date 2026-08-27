import { passwordRequirementState } from './passwordPolicy';

type PasswordRequirementsProps = {
  password: string;
  language?: 'en' | 'ar';
};

export function PasswordRequirements({ password, language = 'en' }: PasswordRequirementsProps) {
  const state = passwordRequirementState(password);
  const isArabic = language === 'ar';
  const requirements = [
    {
      met: state.minimumLength,
      text: isArabic ? '8 أحرف على الأقل' : 'At least 8 characters',
    },
    {
      met: state.hasLetter,
      text: isArabic ? 'حرف واحد على الأقل' : 'At least one letter',
    },
    {
      met: state.hasNumber,
      text: isArabic ? 'رقم واحد على الأقل' : 'At least one number',
    },
  ];

  return (
    <div className="password-requirements" aria-live="polite">
      <strong>{isArabic ? 'متطلبات كلمة المرور' : 'Password requirements'}</strong>
      <ul>
        {requirements.map((requirement) => (
          <li
            className={requirement.met ? 'is-met' : undefined}
            key={requirement.text}
            aria-label={`${requirement.met ? 'Met' : 'Not met'}: ${requirement.text}`}
          >
            <span aria-hidden="true">✓</span> {requirement.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
