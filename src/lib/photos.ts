/** True when a profile photo URL looks real enough to attempt rendering. */
export function isUsablePhotoUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed === 'undefined' || trimmed === 'null') return false;
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:image/');
}

export function sanitizePhotoUrl(url: unknown): string | undefined {
  return isUsablePhotoUrl(typeof url === 'string' ? url : undefined)
    ? String(url).trim()
    : undefined;
}
