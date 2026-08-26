export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 256;

export type PasswordRequirementState = {
  minimumLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  valid: boolean;
};

export function passwordRequirementState(password: string): PasswordRequirementState {
  const minimumLength = password.length >= PASSWORD_MIN_LENGTH;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return {
    minimumLength,
    hasLetter,
    hasNumber,
    valid: minimumLength && hasLetter && hasNumber && password.length <= PASSWORD_MAX_LENGTH,
  };
}

export function passwordPolicyError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[A-Za-z]/.test(password)) {
    return 'Password must contain at least one letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password cannot exceed ${PASSWORD_MAX_LENGTH} characters.`;
  }
  return null;
}
