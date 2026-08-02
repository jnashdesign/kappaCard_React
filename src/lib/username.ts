import { RESERVED_USERNAMES } from '../types';

const USERNAME_REGEX = /^[a-z0-9]([a-z0-9_]{1,28}[a-z0-9])?$/;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '_');
}

/** Live input: lowercase only; keep letters, numbers, underscore. */
export function sanitizeUsernameInput(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function validateUsername(input: string): string | null {
  const username = normalizeUsername(input);

  if (username.length < 3) return 'Username must be at least 3 characters.';
  if (username.length > 30) return 'Username must be 30 characters or fewer.';
  if (!USERNAME_REGEX.test(username)) {
    return 'Use lowercase letters, numbers, and underscores only.';
  }
  if ((RESERVED_USERNAMES as readonly string[]).includes(username)) {
    return 'That username is reserved.';
  }
  return null;
}

export function createInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function suggestUsernameFromName(name: string): string {
  const base = normalizeUsername(name.replace(/[^a-zA-Z0-9\s]/g, '')).replace(/_+/g, '_');
  if (base.length >= 3) return base.slice(0, 30);
  return `brother_${Math.floor(Math.random() * 9000 + 1000)}`;
}
