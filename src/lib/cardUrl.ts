/** Query flag encoded in Kappa Card QR codes to mark scan-origin visits. */
export const QR_VIA_PARAM = 'via';
export const QR_VIA_VALUE = 'qr';

export type ProfileVisitSource = 'qr' | 'direct';

/** Normal public profile path (no QR attribution). */
export function publicCardPath(username: string): string {
  return `/card/${encodeURIComponent(username)}`;
}

/** Absolute public profile URL for sharing / vCard (no QR attribution). */
export function publicCardUrl(origin: string, username: string): string {
  return `${origin.replace(/\/$/, '')}${publicCardPath(username)}`;
}

/** Absolute URL embedded in generated QR codes. */
export function publicCardQrUrl(origin: string, username: string): string {
  return `${publicCardUrl(origin, username)}?${QR_VIA_PARAM}=${QR_VIA_VALUE}`;
}

/** Resolve visit source from a URL search string or URLSearchParams. */
export function profileVisitSourceFromSearch(
  search: string | URLSearchParams
): ProfileVisitSource {
  const params =
    typeof search === 'string' ? new URLSearchParams(search) : search;
  return params.get(QR_VIA_PARAM) === QR_VIA_VALUE ? 'qr' : 'direct';
}

/**
 * Rebuild `/card/{username}` while preserving the current search string
 * (e.g. keep `?via=qr` across username alias redirects).
 */
export function publicCardPathWithSearch(username: string, search: string): string {
  const path = publicCardPath(username);
  if (!search || search === '?') return path;
  return `${path}${search.startsWith('?') ? search : `?${search}`}`;
}
