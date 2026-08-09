import {
  doc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import type { ProfileVisitSource } from './cardUrl';
import type { UserProfile, UserStats } from '../types';

function requireDb() {
  if (!db) throw new Error('Firebase is not configured. Add your VITE_FIREBASE_* env vars.');
  return db;
}

export const EMPTY_USER_STATS: UserStats = {
  logins: 0,
  invitesCreated: 0,
  profileUpdates: 0,
  cardImageDownloads: 0,
  cardViews: 0,
  cardViewsQr: 0,
  cardViewsDirect: 0,
  contactDownloads: 0,
};

export function mapUserStats(data: DocumentData | undefined): UserStats {
  const raw = data?.stats;
  return {
    logins: Number(raw?.logins) || 0,
    invitesCreated: Number(raw?.invitesCreated) || 0,
    profileUpdates: Number(raw?.profileUpdates) || 0,
    cardImageDownloads: Number(raw?.cardImageDownloads) || 0,
    cardViews: Number(raw?.cardViews) || 0,
    cardViewsQr: Number(raw?.cardViewsQr) || 0,
    cardViewsDirect: Number(raw?.cardViewsDirect) || 0,
    contactDownloads: Number(raw?.contactDownloads) || 0,
  };
}

/** Profile complete: identity set + at least one optional enrichment. */
export function isProfileComplete(user: Pick<
  UserProfile,
  | 'username'
  | 'chapter'
  | 'initiationYear'
  | 'phone'
  | 'occupation'
  | 'currentEmployer'
  | 'currentCity'
  | 'profilePicture'
  | 'socialMedia'
>): boolean {
  if (!user.username?.trim() || !user.chapter?.trim() || !user.initiationYear) return false;
  if (user.phone?.trim()) return true;
  if (user.occupation?.trim() || user.currentEmployer?.trim()) return true;
  if (user.currentCity?.trim()) return true;
  if (user.profilePicture?.trim()) return true;
  const socials = user.socialMedia ?? {};
  return Boolean(
    socials.linkedin ||
      socials.x ||
      socials.instagram ||
      socials.snapchat ||
      socials.youtube ||
      socials.tiktok
  );
}

export type OwnStatKey =
  | 'logins'
  | 'invitesCreated'
  | 'profileUpdates'
  | 'cardImageDownloads';

export type PublicStatKey = 'cardViews' | 'contactDownloads';

/**
 * Increment a counter on the actor's own user doc.
 * Fire-and-forget safe: callers may void without awaiting UI.
 */
export async function bumpOwnStat(userId: string, key: OwnStatKey): Promise<void> {
  const database = requireDb();
  await updateDoc(doc(database, 'users', userId), {
    [`stats.${key}`]: increment(1),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Count at most one login per browser tab session (covers restored sessions,
 * not only explicit sign-in clicks).
 */
export async function recordSessionLogin(userId: string): Promise<void> {
  if (typeof sessionStorage !== 'undefined') {
    const key = `kappa:loginCounted:${userId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  }
  await bumpOwnStat(userId, 'logins');
}

/**
 * Record own Kappa Card image download + activation milestone when profile is already complete.
 */
export async function recordCardImageDownload(user: UserProfile): Promise<void> {
  const database = requireDb();
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    'stats.cardImageDownloads': increment(1),
    updatedAt: serverTimestamp(),
  };
  if (!user.firstCardImageDownloadedAt) {
    payload.firstCardImageDownloadedAt = now;
  }
  if (!user.activatedAt && (user.profileCompletedAt || isProfileComplete(user))) {
    payload.activatedAt = user.activatedAt ?? now;
    if (!user.profileCompletedAt) payload.profileCompletedAt = now;
  }
  await setDoc(doc(database, 'users', user.id), payload, { merge: true });
}

/**
 * Public engagement on a card owner's profile (view or contact download).
 * Debounce views in the caller (session) to limit write spam.
 *
 * For profile views (`cardViews`), pass `source` so we can attribute QR vs direct
 * while still incrementing the aggregate `stats.cardViews` counter.
 */
export async function recordPublicCardEngagement(
  subjectUserId: string,
  kind: PublicStatKey,
  existing?: Pick<UserProfile, 'firstCardViewedAt' | 'firstContactDownloadedAt'>,
  options?: { source?: ProfileVisitSource }
): Promise<void> {
  const database = requireDb();
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    [`stats.${kind}`]: increment(1),
    updatedAt: serverTimestamp(),
  };

  if (kind === 'cardViews') {
    const source = options?.source === 'qr' ? 'qr' : 'direct';
    payload[source === 'qr' ? 'stats.cardViewsQr' : 'stats.cardViewsDirect'] = increment(1);
  }

  if (kind === 'cardViews' && !existing?.firstCardViewedAt) {
    payload.firstCardViewedAt = now;
  }
  if (kind === 'contactDownloads' && !existing?.firstContactDownloadedAt) {
    payload.firstContactDownloadedAt = now;
  }
  await setDoc(doc(database, 'users', subjectUserId), payload, { merge: true });
}
