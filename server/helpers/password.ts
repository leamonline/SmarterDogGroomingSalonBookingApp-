/**
 * Shared password strength validation.
 * Returns null if the password is strong enough, or an error message string otherwise.
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain uppercase, lowercase, and a number";
  }
  return null;
}

const COMMON_PASSWORDS = new Set(["password", "admin123", "12345678", "qwerty123"]);

/**
 * Checks whether a password is considered weak (used during login to flag accounts).
 */
export function isWeakPassword(password: string): boolean {
  return (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    COMMON_PASSWORDS.has(password.toLowerCase())
  );
}
