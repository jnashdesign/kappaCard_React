/** Signup URL for an invite code. */
export function inviteSignupUrl(origin: string, code: string): string {
  const trimmed = code.trim().toUpperCase();
  return `${origin.replace(/\/$/, '')}/signup?invite=${encodeURIComponent(trimmed)}`;
}

export function inviteShareMessage(code: string, signupUrl: string, inviterName?: string): string {
  const who = inviterName?.trim() || 'a brother';
  return [
    `${who} invited you to MyKappaCard.`,
    '',
    `Use this link to create your account:`,
    signupUrl,
    '',
    `Or enter invite code ${code.trim().toUpperCase()} at signup.`,
  ].join('\n');
}

export function inviteMailtoHref(code: string, signupUrl: string, inviterName?: string): string {
  const subject = encodeURIComponent('Your MyKappaCard invite');
  const body = encodeURIComponent(inviteShareMessage(code, signupUrl, inviterName));
  return `mailto:?subject=${subject}&body=${body}`;
}

/** Opens the device SMS composer with a prefilled invite message. */
export function inviteSmsHref(code: string, signupUrl: string, inviterName?: string): string {
  const body = encodeURIComponent(inviteShareMessage(code, signupUrl, inviterName));
  // iOS prefers sms:&body= ; Android commonly uses sms:?body=
  const ios = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return ios ? `sms:&body=${body}` : `sms:?body=${body}`;
}
