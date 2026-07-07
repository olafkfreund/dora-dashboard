// Password policy for local accounts (regulated-environment baseline).
// Min 12 chars, with lower + upper + digit + symbol.

export const PASSWORD_MIN_LENGTH = 12

/** Returns an error message if the password is too weak, or null if it passes. */
export function validatePassword(pw: string): string | null {
  if (pw.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
  if (!/[a-z]/.test(pw)) return "Password must include a lowercase letter."
  if (!/[A-Z]/.test(pw)) return "Password must include an uppercase letter."
  if (!/[0-9]/.test(pw)) return "Password must include a digit."
  if (!/[^A-Za-z0-9]/.test(pw)) return "Password must include a symbol."
  return null
}
