import { doc, getDoc, type DocumentData } from 'firebase/firestore';
import { db } from './firebase';
import { sanitizePhotoUrl } from './photos';
import { EMPTY_USER_STATS } from './userStats';
import { normalizeUsername } from './username';
import type { MembershipTier, SocialMedia, UserProfile } from '../types';
import { mapWebsites } from './websites';

function requireDb() {
  if (!db) throw new Error('Firebase is not configured. Add your VITE_FIREBASE_* env vars.');
  return db;
}

/**
 * Map a publicProfiles/{uid} doc into a UserProfile-shaped object for card / Brothers UI.
 * Private fields are simply absent from the doc (not present as empty secrets).
 */
export function mapPublicProfile(id: string, data: DocumentData): UserProfile {
  const socialMedia = (data.socialMedia ?? {}) as SocialMedia;
  const websites = mapWebsites(data.websites);
  const inauguralMember = Boolean(data.inauguralMember || data.foundingMember);
  const inauguralSlot =
    typeof data.inauguralSlot === 'number'
      ? data.inauguralSlot
      : typeof data.foundingSlot === 'number'
        ? data.foundingSlot
        : undefined;

  return {
    id,
    email: typeof data.email === 'string' ? data.email : '',
    name: data.name ?? '',
    username: data.username ?? '',
    phone: typeof data.phone === 'string' ? data.phone : undefined,
    chapter: data.chapter || data.chapterOfInitiation || '',
    chapterOfInitiation: data.chapterOfInitiation || data.chapter || '',
    currentChapter: typeof data.currentChapter === 'string' ? data.currentChapter : undefined,
    initiationYear: data.initiationYear ?? new Date().getFullYear(),
    occupation: typeof data.occupation === 'string' ? data.occupation : undefined,
    currentEmployer: typeof data.currentEmployer === 'string' ? data.currentEmployer : undefined,
    currentCity: typeof data.currentCity === 'string' ? data.currentCity : undefined,
    profilePicture: sanitizePhotoUrl(data.profilePicture),
    profilePicturePath:
      typeof data.profilePicturePath === 'string' ? data.profilePicturePath : undefined,
    contactPhoto: sanitizePhotoUrl(data.contactPhoto),
    contactPhotoPath:
      typeof data.contactPhotoPath === 'string' ? data.contactPhotoPath : undefined,
    cardBackground: sanitizePhotoUrl(data.cardBackground),
    cardBackgroundPath:
      typeof data.cardBackgroundPath === 'string' ? data.cardBackgroundPath : undefined,
    socialMedia,
    websites: websites.length ? websites : undefined,
    invitedBy: typeof data.invitedBy === 'string' ? data.invitedBy : undefined,
    invitedByUsername:
      typeof data.invitedByUsername === 'string' ? data.invitedByUsername : undefined,
    invitedByName: typeof data.invitedByName === 'string' ? data.invitedByName : undefined,
    invitedByChapter:
      typeof data.invitedByChapter === 'string' ? data.invitedByChapter : undefined,
    invitedByInitiationYear:
      typeof data.invitedByInitiationYear === 'number' ? data.invitedByInitiationYear : undefined,
    inviteCode: '',
    tier: 'free' as MembershipTier,
    inauguralMember,
    inauguralSlot: inauguralMember ? inauguralSlot : undefined,
    foundingMember: inauguralMember,
    foundingSlot: inauguralMember ? inauguralSlot : undefined,
    excludeFromInaugural: false,
    admin: false,
    stats: EMPTY_USER_STATS,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}

export async function getPublicProfileById(userId: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(requireDb(), 'publicProfiles', userId));
  if (!snap.exists()) return null;
  return mapPublicProfile(snap.id, snap.data());
}

/**
 * Resolve username (including old aliases) → publicProfiles/{uid}.
 */
export async function getPublicProfileByUsername(username: string): Promise<UserProfile | null> {
  const database = requireDb();
  const normalized = normalizeUsername(username);

  const aliasSnap = await getDoc(doc(database, 'usernames', normalized));
  if (!aliasSnap.exists()) return null;

  const userId = aliasSnap.data().userId as string;
  const redirectedTo =
    typeof aliasSnap.data().redirectedTo === 'string'
      ? (aliasSnap.data().redirectedTo as string)
      : undefined;

  const profile = await getPublicProfileById(userId);
  if (!profile) return null;

  // Alias docs may point at an older slug; prefer live username from projection.
  if (redirectedTo && profile.username !== normalized) {
    return profile;
  }
  return profile;
}
