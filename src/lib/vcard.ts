import { blobToBase64, blobToSquareJpegBase64 } from './contactPhoto';
import { profilePhotoBlob } from './storage';
import { publicCardUrl } from './cardUrl';
import { socialProfileUrl } from './social';
import type { UserProfile } from '../types';

type InviterFields = Pick<
  UserProfile,
  | 'invitedByName'
  | 'invitedByChapter'
  | 'invitedByInitiationYear'
>;

type VCardUser = Pick<
  UserProfile,
  | 'name'
  | 'email'
  | 'phone'
  | 'chapter'
  | 'initiationYear'
  | 'occupation'
  | 'currentCity'
  | 'currentEmployer'
  | 'socialMedia'
  | 'websites'
  | 'username'
  | 'profilePicture'
  | 'profilePicturePath'
  | 'contactPhoto'
  | 'contactPhotoPath'
  | 'invitedByName'
  | 'invitedByChapter'
  | 'invitedByInitiationYear'
>;

export type DownloadVCardResult = {
  includedPhoto: boolean;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        window.clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

/** Load photo bytes for vCard. Prefer the pre-generated 320×320 JPEG. */
async function resolvePhotoBase64(user: VCardUser): Promise<string | null> {
  if (user.contactPhoto) {
    try {
      const response = await fetch(user.contactPhoto, { mode: 'cors' });
      if (response.ok) {
        const encoded = await blobToBase64(await response.blob());
        if (encoded) return encoded;
      }
    } catch {
      // fall through
    }
  }

  if (user.contactPhotoPath) {
    try {
      const blob = await profilePhotoBlob(user.contactPhotoPath);
      const encoded = await blobToBase64(blob);
      if (encoded) return encoded;
    } catch {
      // fall through
    }
  }

  if (user.profilePicture) {
    try {
      const response = await fetch(user.profilePicture, { mode: 'cors' });
      if (response.ok) {
        const encoded = await blobToSquareJpegBase64(await response.blob());
        if (encoded) return encoded;
      }
    } catch {
      // fall through
    }
  }

  if (user.profilePicturePath) {
    try {
      const blob = await profilePhotoBlob(user.profilePicturePath);
      const encoded = await blobToSquareJpegBase64(blob);
      if (encoded) return encoded;
    } catch {
      // fall through
    }
  }

  return null;
}

/** vCard lines should fold at 75 octets (CRLF + space continuation). */
function foldVCardLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let remaining = line;
  chunks.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    chunks.push(` ${remaining.slice(0, 74)}`);
    remaining = remaining.slice(74);
  }
  return chunks.join('\r\n');
}

/** Apple Contacts expects TYPE then ENCODING=BASE64 (not the shorter ENCODING=b form). */
function buildPhotoLines(photoBase64: string): string[] {
  const header = 'PHOTO;TYPE=JPEG;ENCODING=BASE64:';
  const folded = foldVCardLine(`${header}${photoBase64}`);
  return folded.split('\r\n');
}

export function buildVCard(user: VCardUser, photoBase64?: string | null): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVCard(user.name)}`,
    `N:${formatName(user.name)}`,
  ];

  if (user.email) lines.push(`EMAIL;TYPE=INTERNET:${escapeVCard(user.email)}`);
  if (user.phone) lines.push(`TEL;TYPE=CELL:${escapeVCard(user.phone)}`);

  const orgParts = [user.chapter, user.initiationYear ? String(user.initiationYear) : '']
    .filter(Boolean)
    .join(' ');
  if (orgParts) lines.push(`ORG:${escapeVCard(orgParts)}`);

  if (user.currentCity) {
    lines.push(`ADR;TYPE=HOME:;;${escapeVCard(user.currentCity)};;;;`);
  }

  if (photoBase64) {
    lines.push(...buildPhotoLines(photoBase64));
  }

  const noteParts: string[] = [];
  if (user.occupation) noteParts.push(`Occupation: ${user.occupation}`);
  if (user.currentEmployer) noteParts.push(`Employer: ${user.currentEmployer}`);
  const inviter = formatInviter(user);
  if (inviter) {
    if (noteParts.length > 0) noteParts.push('');
    noteParts.push(`Added from KappaCard.com\nThis brother was invited to Kappacards.com By:\n ${inviter}`);
  }
  if (noteParts.length > 0) {
    lines.push(`NOTE:${escapeVCard(noteParts.join('\n'))}`);
  }

  const socials = user.socialMedia;
  if (socials?.linkedin) {
    const href = socialProfileUrl('linkedin', socials.linkedin);
    if (href) lines.push(`URL;TYPE=LinkedIn:${escapeVCard(href)}`);
  }
  if (socials?.x) {
    const href = socialProfileUrl('x', socials.x);
    if (href) lines.push(`URL;TYPE=X:${escapeVCard(href)}`);
  }
  if (socials?.instagram) {
    const href = socialProfileUrl('instagram', socials.instagram);
    if (href) lines.push(`URL;TYPE=Instagram:${escapeVCard(href)}`);
  }
  if (socials?.snapchat) {
    const href = socialProfileUrl('snapchat', socials.snapchat);
    if (href) lines.push(`URL;TYPE=Snapchat:${escapeVCard(href)}`);
  }
  if (socials?.youtube) {
    const href = socialProfileUrl('youtube', socials.youtube);
    if (href) lines.push(`URL;TYPE=YouTube:${escapeVCard(href)}`);
  }
  if (socials?.tiktok) {
    const href = socialProfileUrl('tiktok', socials.tiktok);
    if (href) lines.push(`URL;TYPE=TikTok:${escapeVCard(href)}`);
  }

  const websites = user.websites ?? [];
  for (const site of websites) {
    if (!site.url) continue;
    const type = vcardUrlType(site.title);
    lines.push(`URL;TYPE=${type}:${escapeVCard(site.url)}`);
  }

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://mykappacard.com';
  lines.push(`URL:${publicCardUrl(origin, user.username)}`);
  lines.push('END:VCARD');

  return lines.filter(Boolean).join('\r\n');
}

export async function downloadVCard(
  user: VCardUser,
  _options?: { imageEl?: HTMLImageElement | null }
): Promise<DownloadVCardResult> {
  const wantsPhoto = Boolean(
    user.contactPhoto || user.contactPhotoPath || user.profilePicture || user.profilePicturePath
  );
  // Never block contact download if Storage is slow/CORS-blocked
  const photoBase64 = wantsPhoto ? await withTimeout(resolvePhotoBase64(user), 6000) : null;

  const content = buildVCard(user, photoBase64);
  const blob = new Blob([content], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(user.name || user.username).replace(/\s+/g, '_')}.vcf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { includedPhoto: Boolean(photoBase64) };
}

export function formatInviter(user: InviterFields): string | null {
  const namePart = user.invitedByName?.trim() || null;
  if (!namePart) return null;

  const chapterYear = [user.invitedByChapter, user.invitedByInitiationYear]
    .filter((part) => part !== undefined && part !== null && String(part).trim() !== '')
    .join(' ');

  return chapterYear ? `${namePart} ◆ ${chapterYear}` : namePart;
}

function escapeVCard(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function formatName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return `;${escapeVCard(parts[0])};;;`;
  const first = parts[0];
  const last = parts.slice(1).join(' ');
  return `${escapeVCard(last)};${escapeVCard(first)};;;`;
}

/** vCard TYPE tokens are safer as alphanumeric; fall back to Website. */
function vcardUrlType(title: string | undefined): string {
  const token = (title ?? '')
    .replace(/[^A-Za-z0-9]+/g, '')
    .slice(0, 24);
  return token || 'Website';
}
