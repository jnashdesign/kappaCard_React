/** Firebase Auth `error.code`, or a code parsed from `Firebase: Error (auth/…).` */
export function authErrorCode(err: unknown): string | null {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: unknown }).code);
    if (code.startsWith('auth/')) return code;
  }
  if (err instanceof Error) {
    const match = err.message.match(/auth\/[\w-]+/);
    if (match) return match[0];
  }
  return null;
}

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-credential':
    'Email or password is incorrect. Try again, or reset your password.',
  'auth/invalid-login-credentials':
    'Email or password is incorrect. Try again, or reset your password.',
  'auth/wrong-password': 'Email or password is incorrect. Try again, or reset your password.',
  'auth/user-not-found': 'Email or password is incorrect. Try again, or reset your password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/missing-email': 'Enter your email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/user-disabled': 'This account has been disabled. Contact support if you need help.',
  'auth/too-many-requests':
    'Too many attempts. Wait a few minutes, or reset your password.',
  'auth/network-request-failed': 'Check your internet connection and try again.',
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/weak-password': 'Use a stronger password (at least 6 characters).',
  'auth/operation-not-allowed': 'This sign-in method is not available right now. Try again later.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Google sign-in was cancelled.',
  'auth/popup-blocked': 'Allow popups in your browser to sign in with Google.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method.',
  'auth/requires-recent-login': 'Please sign in again to continue.',
  'auth/invalid-action-code': 'This password reset link is invalid or has already been used.',
  'auth/expired-action-code': 'This password reset link has expired. Request a new one.',
  'auth/credential-already-in-use': 'This sign-in method is already linked to another account.',
};

/**
 * Turn Firebase Auth (and similar) failures into copy a member can act on.
 * Known app Error messages (invite, username, etc.) pass through unchanged.
 */
export function friendlyAuthError(
  err: unknown,
  fallback: string,
  overrides?: Partial<Record<string, string>>
): string {
  const code = authErrorCode(err);
  if (code) {
    return overrides?.[code] || AUTH_MESSAGES[code] || fallback;
  }

  if (err instanceof Error && err.message.trim()) {
    const message = err.message.trim();
    if (/^Firebase(Error)?:/i.test(message) || /auth\/[\w-]+/.test(message)) {
      return fallback;
    }
    return message;
  }

  return fallback;
}
