import type { SocialMedia } from '../types';

export type SocialNetwork =
  | 'linkedin'
  | 'x'
  | 'instagram'
  | 'snapchat'
  | 'youtube'
  | 'tiktok';

export type SocialLink = {
  network: SocialNetwork;
  label: string;
  href: string;
};

function cleanHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '').replace(/^\/+/, '');
}

/** Build absolute profile URLs from stored handles (handles only, not full URLs). */
export function socialProfileUrl(network: SocialNetwork, handle: string): string | null {
  const value = cleanHandle(handle);
  if (!value) return null;

  switch (network) {
    case 'linkedin':
      return `https://www.linkedin.com/in/${encodeURIComponent(value)}`;
    case 'x':
      return `https://x.com/${encodeURIComponent(value)}`;
    case 'instagram':
      return `https://www.instagram.com/${encodeURIComponent(value)}`;
    case 'snapchat':
      return `https://www.snapchat.com/add/${encodeURIComponent(value)}`;
    case 'youtube':
      return `https://www.youtube.com/@${encodeURIComponent(value)}`;
    case 'tiktok':
      return `https://www.tiktok.com/@${encodeURIComponent(value)}`;
  }
}

const NETWORK_META: Array<{ network: SocialNetwork; label: string }> = [
  { network: 'linkedin', label: 'LinkedIn' },
  { network: 'x', label: 'X' },
  { network: 'instagram', label: 'Instagram' },
  { network: 'snapchat', label: 'Snapchat' },
  { network: 'youtube', label: 'YouTube' },
  { network: 'tiktok', label: 'TikTok' },
];

export function publicSocialLinks(socialMedia?: SocialMedia | null): SocialLink[] {
  if (!socialMedia) return [];

  const links: SocialLink[] = [];
  for (const { network, label } of NETWORK_META) {
    const handle = socialMedia[network];
    if (!handle) continue;
    const href = socialProfileUrl(network, handle);
    if (href) links.push({ network, label, href });
  }
  return links;
}
