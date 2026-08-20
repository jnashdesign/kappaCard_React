import type { ProfileWebsite } from '../types';

export const MAX_WEBSITES = 12;
export const MAX_WEBSITE_TITLE = 80;

export function createWebsiteDraft(): ProfileWebsite {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `web_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return { id, title: '', url: '' };
}

export function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
}

/** Accepts example.com or https://example.com. Rejects non-http(s) schemes. */
export function normalizeWebsiteUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 500) return null;
  if (/^(javascript|data|vbscript|file|blob):/i.test(trimmed)) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname.includes('.')) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function mapWebsites(raw: unknown): ProfileWebsite[] {
  if (!Array.isArray(raw)) return [];
  const out: ProfileWebsite[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const data = item as Record<string, unknown>;
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    const url = typeof data.url === 'string' ? data.url.trim() : '';
    if (!title && !url) continue;
    const id =
      typeof data.id === 'string' && data.id.trim() ? data.id.trim() : createWebsiteDraft().id;
    out.push({ id, title, url });
    if (out.length >= MAX_WEBSITES) break;
  }
  return out;
}

export function sanitizeWebsitesForSave(rows: ProfileWebsite[]): {
  websites: ProfileWebsite[];
  error: string | null;
} {
  const websites: ProfileWebsite[] = [];

  for (const row of rows) {
    const title = row.title.trim().slice(0, MAX_WEBSITE_TITLE);
    const urlInput = row.url.trim();
    if (!title && !urlInput) continue;

    if (!urlInput) {
      return { websites: [], error: `Add a URL for “${title}”.` };
    }

    const url = normalizeWebsiteUrl(urlInput);
    if (!url) {
      return {
        websites: [],
        error: `Enter a valid website address${title ? ` for “${title}”` : ''} (example.com).`,
      };
    }

    websites.push({
      id: row.id?.trim() || createWebsiteDraft().id,
      title: title || hostnameFromUrl(url),
      url,
    });

    if (websites.length >= MAX_WEBSITES) break;
  }

  return { websites, error: null };
}
