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

/** Default crimson wash when no custom card background is set. */
export const CARD_FALLBACK_GRADIENT =
  'linear-gradient(160deg, #4a090a 0%, #6d0e0f 45%, #8a1a1c 100%)';

/** Scrim over custom backgrounds so name/QR stay readable. */
export const CARD_BACKGROUND_SCRIM =
  'linear-gradient(160deg, rgba(74,9,10,0.7) 0%, rgba(109,14,15,0.75) 45%, rgba(138,26,28,0.7) 100%)';

/** CSS for My Card / public hero — custom image or crimson gradient. */
export function cardSurfaceBackground(imageUrl: string | null | undefined): {
  background?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
} {
  if (!isUsablePhotoUrl(imageUrl)) {
    return { background: CARD_FALLBACK_GRADIENT };
  }
  // Escape characters that would break a CSS url() value
  const safeUrl = String(imageUrl).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return {
    backgroundImage: `${CARD_BACKGROUND_SCRIM}, url("${safeUrl}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}
