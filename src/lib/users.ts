import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  type User,
} from 'firebase/auth';
import { deleteObject, listAll, ref } from 'firebase/storage';
import { auth, db, googleProvider, storage } from './firebase';
import { deleteAllCollectedCards } from './collectedCards';
import type {
  AccountDeletion,
  FieldPrivacy,
  InviteRecord,
  MembershipTier,
  UserProfile,
} from '../types';
import { normalizeFieldPrivacy } from './privacy';
import { sanitizePhotoUrl } from './photos';
import { createInviteCode, normalizeUsername, validateUsername } from './username';
import { EMPTY_USER_STATS, bumpOwnStat, isProfileComplete, mapUserStats } from './userStats';

function requireDb() {
  if (!db) throw new Error('Firebase is not configured. Add your VITE_FIREBASE_* env vars.');
  return db;
}

/** Firestore rejects `undefined`; omit those keys (including nested plain objects). */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }
  // Only recurse plain objects — leave FieldValue, Date, etc. untouched
  if (
    value &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (nested === undefined) continue;
      result[key] = stripUndefined(nested);
    }
    return result as T;
  }
  return value;
}

export function mapUser(id: string, data: DocumentData): UserProfile {
  return {
    id,
    email: data.email ?? '',
    name: data.name ?? '',
    username: data.username ?? '',
    phone: data.phone,
    chapter: data.chapter || data.chapterOfInitiation || '',
    chapterOfInitiation: data.chapterOfInitiation || data.chapter || '',
    currentChapter: data.currentChapter,
    initiationYear: data.initiationYear ?? new Date().getFullYear(),
    occupation: data.occupation,
    currentEmployer: data.currentEmployer,
    currentCity: data.currentCity,
    province: typeof data.province === 'string' ? data.province : undefined,
    profilePicture: sanitizePhotoUrl(data.profilePicture),
    profilePicturePath: typeof data.profilePicturePath === 'string' ? data.profilePicturePath : undefined,
    cardBackground: sanitizePhotoUrl(data.cardBackground),
    cardBackgroundPath:
      typeof data.cardBackgroundPath === 'string' ? data.cardBackgroundPath : undefined,
    socialMedia: data.socialMedia ?? {},
    fieldPrivacy: normalizeFieldPrivacy(data.fieldPrivacy as FieldPrivacy | undefined),
    invitedBy: data.invitedBy,
    invitedByUsername: data.invitedByUsername,
    invitedByName: data.invitedByName,
    invitedByChapter: data.invitedByChapter,
    invitedByInitiationYear: data.invitedByInitiationYear,
    inviteCode: data.inviteCode ?? '',
    tier: (data.tier as MembershipTier) ?? 'free',
    admin: Boolean(data.admin),
    stats: mapUserStats(data),
    profileCompletedAt:
      typeof data.profileCompletedAt === 'string' ? data.profileCompletedAt : undefined,
    activatedAt: typeof data.activatedAt === 'string' ? data.activatedAt : undefined,
    firstCardImageDownloadedAt:
      typeof data.firstCardImageDownloadedAt === 'string'
        ? data.firstCardImageDownloadedAt
        : undefined,
    firstCardViewedAt:
      typeof data.firstCardViewedAt === 'string' ? data.firstCardViewedAt : undefined,
    firstContactDownloadedAt:
      typeof data.firstContactDownloadedAt === 'string'
        ? data.firstContactDownloadedAt
        : undefined,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? data.updatedAt ?? new Date().toISOString(),
  };
}

export async function getUserById(userId: string): Promise<UserProfile | null> {
  const database = requireDb();
  const snap = await getDoc(doc(database, 'users', userId));
  if (!snap.exists()) return null;
  return mapUser(snap.id, snap.data());
}

export async function getUserByUsername(username: string): Promise<UserProfile | null> {
  const database = requireDb();
  const normalized = normalizeUsername(username);

  const usersQuery = query(collection(database, 'users'), where('username', '==', normalized));
  const usersSnap = await getDocs(usersQuery);
  if (!usersSnap.empty) {
    const first = usersSnap.docs[0];
    return mapUser(first.id, first.data());
  }

  const aliasSnap = await getDoc(doc(database, 'usernames', normalized));
  if (aliasSnap.exists()) {
    const userId = aliasSnap.data().userId as string;
    return getUserById(userId);
  }

  return null;
}

export async function isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
  const database = requireDb();
  const normalized = normalizeUsername(username);
  if (validateUsername(normalized)) return false;

  const aliasRef = doc(database, 'usernames', normalized);
  const usersQuery = query(collection(database, 'users'), where('username', '==', normalized));
  const [aliasSnap, usersSnap] = await Promise.all([getDoc(aliasRef), getDocs(usersQuery)]);

  if (aliasSnap.exists()) {
    return aliasSnap.data().userId === excludeUserId;
  }
  if (usersSnap.empty) return true;
  return usersSnap.docs.every((d) => d.id === excludeUserId);
}

export async function claimUsername(
  userId: string,
  username: string,
  previousUsername?: string,
  options?: { skipAvailabilityCheck?: boolean }
): Promise<void> {
  const database = requireDb();
  const normalized = normalizeUsername(username);
  const error = validateUsername(normalized);
  if (error) throw new Error(error);

  if (!options?.skipAvailabilityCheck) {
    const available = await isUsernameAvailable(normalized, userId);
    if (!available) throw new Error('That username is already taken.');
  }

  await setDoc(doc(database, 'usernames', normalized), {
    username: normalized,
    userId,
    current: true,
    createdAt: new Date().toISOString(),
  });

  if (previousUsername && previousUsername !== normalized) {
    await setDoc(
      doc(database, 'usernames', previousUsername),
      {
        username: previousUsername,
        userId,
        current: false,
        redirectedTo: normalized,
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }
}

export async function createUserProfile(
  userId: string,
  input: {
    email: string;
    name: string;
    username: string;
    chapter: string;
    initiationYear: number;
    inviteCode?: string;
    admin?: boolean;
    tier?: MembershipTier;
    /** Admin/seed bootstrap: skip invite code and attach inviter directly */
    seededBy?: {
      inviterId: string;
      inviterUsername: string;
      inviterName?: string;
      inviterChapter?: string;
      inviterInitiationYear?: number;
    };
  }
): Promise<UserProfile> {
  const database = requireDb();
  const username = normalizeUsername(input.username);
  const error = validateUsername(username);
  if (error) throw new Error(error);

  const available = await isUsernameAvailable(username);
  if (!available) throw new Error('That username is already taken.');

  let invitedBy: string | undefined;
  let invitedByUsername: string | undefined;
  let invitedByName: string | undefined;
  let invitedByChapter: string | undefined;
  let invitedByInitiationYear: number | undefined;
  let inviteDocId: string | undefined;
  let inviteGrantsBasic = false;
  let inviteMultiUse = false;

  if (input.admin) {
    // Seed admin has no inviter
  } else if (input.seededBy) {
    invitedBy = input.seededBy.inviterId;
    invitedByUsername = input.seededBy.inviterUsername;
    invitedByName = input.seededBy.inviterName;
    invitedByChapter = input.seededBy.inviterChapter;
    invitedByInitiationYear = input.seededBy.inviterInitiationYear;
  } else {
    if (!input.inviteCode?.trim()) {
      throw new Error('An invite code is required to create an account.');
    }

    const invitesQuery = query(
      collection(database, 'invites'),
      where('code', '==', input.inviteCode.trim().toUpperCase()),
      where('active', '==', true)
    );
    const inviteSnap = await getDocs(invitesQuery);
    if (inviteSnap.empty) throw new Error('Invalid or inactive invite code.');

    const inviteDoc = inviteSnap.docs[0];
    const invite = inviteDoc.data() as InviteRecord;
    if (!invite.multiUse && invite.usedBy) {
      throw new Error('This invite code has already been used.');
    }

    invitedBy = invite.inviterId;
    invitedByUsername = invite.inviterUsername;
    invitedByName = invite.inviterName;
    invitedByChapter = invite.inviterChapter;
    invitedByInitiationYear = invite.inviterInitiationYear;
    inviteDocId = inviteDoc.id;
    inviteGrantsBasic = Boolean(invite.grantsBasic);
    inviteMultiUse = Boolean(invite.multiUse);

    // Backfill chapter/year from inviter profile when older invites lack them
    if (invitedBy && (!invitedByChapter || !invitedByInitiationYear)) {
      const inviterSnap = await getDoc(doc(database, 'users', invitedBy));
      if (inviterSnap.exists()) {
        const inviter = inviterSnap.data();
        invitedByChapter = invitedByChapter || inviter.chapter || inviter.chapterOfInitiation;
        invitedByInitiationYear = invitedByInitiationYear || inviter.initiationYear;
        invitedByName = invitedByName || inviter.name;
      }
    }
  }

  const personalInviteCode = createInviteCode();
  const now = new Date().toISOString();

  // Invite path: tier comes from the invite (complimentary Basic vs paywalled free).
  // Seed/admin paths may pass an explicit tier.
  let tier: MembershipTier = 'free';
  if (input.admin || input.seededBy) {
    tier = input.tier ?? (input.admin ? 'premium' : 'free');
  } else if (inviteGrantsBasic) {
    tier = 'basic';
  }

  const profile: Omit<UserProfile, 'id'> = {
    email: input.email,
    name: input.name.trim(),
    username,
    chapter: input.chapter,
    chapterOfInitiation: input.chapter,
    initiationYear: input.initiationYear,
    invitedBy,
    invitedByUsername,
    invitedByName,
    invitedByChapter,
    invitedByInitiationYear,
    inviteCode: personalInviteCode,
    tier,
    admin: Boolean(input.admin),
    stats: EMPTY_USER_STATS,
    socialMedia: {},
    createdAt: now,
    updatedAt: now,
  };

  // Parallel writes: user doc, username claim, personal invite (skip re-checking username)
  await Promise.all([
    setDoc(doc(database, 'users', userId), {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    claimUsername(userId, username, undefined, { skipAvailabilityCheck: true }),
    setDoc(doc(database, 'invites', `${userId}_${personalInviteCode}`), {
      code: personalInviteCode,
      inviterId: userId,
      inviterName: profile.name,
      inviterUsername: username,
      inviterChapter: profile.chapter,
      inviterInitiationYear: profile.initiationYear,
      active: true,
      createdAt: now,
      grantsBasic: false,
    }),
  ]);

  if (inviteDocId) {
    const inviteRef = doc(database, 'invites', inviteDocId);
    if (inviteMultiUse) {
      await updateDoc(inviteRef, {
        useCount: increment(1),
        lastUsedAt: now,
      });
    } else {
      await updateDoc(inviteRef, {
        usedBy: userId,
        usedAt: now,
        active: false,
      });
    }
  }

  return { id: userId, ...profile };
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>,
  previousUsername?: string
): Promise<void> {
  const database = requireDb();

  // Never let the client escalate privileges or spoof analytics through profile save
  const {
    id: _id,
    admin: _admin,
    tier: _tier,
    invitedBy: _invitedBy,
    invitedByUsername: _invitedByUsername,
    invitedByName: _invitedByName,
    invitedByChapter: _invitedByChapter,
    invitedByInitiationYear: _invitedByInitiationYear,
    stats: _stats,
    profileCompletedAt: _profileCompletedAt,
    activatedAt: _activatedAt,
    firstCardImageDownloadedAt: _firstCardImageDownloadedAt,
    firstCardViewedAt: _firstCardViewedAt,
    firstContactDownloadedAt: _firstContactDownloadedAt,
    ...safeUpdates
  } = updates;

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  // Optional scalars: empty/undefined must deleteField — merge:true keeps old values otherwise
  const clearableScalars = [
    'phone',
    'occupation',
    'currentEmployer',
    'currentCity',
    'province',
  ] as const;

  for (const key of clearableScalars) {
    if (key in safeUpdates) {
      const value = safeUpdates[key];
      const trimmed = typeof value === 'string' ? value.trim() : value;
      payload[key] = trimmed ? trimmed : deleteField();
    }
  }

  // Nested social map is deep-merged by Firestore; clear missing handles explicitly
  if ('socialMedia' in safeUpdates) {
    const sm = safeUpdates.socialMedia ?? {};
    payload.socialMedia = {
      linkedin: sm.linkedin?.trim() ? sm.linkedin.trim() : deleteField(),
      x: sm.x?.trim() ? sm.x.trim() : deleteField(),
      instagram: sm.instagram?.trim() ? sm.instagram.trim() : deleteField(),
      snapchat: sm.snapchat?.trim() ? sm.snapchat.trim() : deleteField(),
    };
  }

  if (safeUpdates.name !== undefined) payload.name = safeUpdates.name;
  if (safeUpdates.chapter !== undefined) payload.chapter = safeUpdates.chapter;
  if (safeUpdates.chapterOfInitiation !== undefined) {
    payload.chapterOfInitiation = safeUpdates.chapterOfInitiation;
  }
  if (safeUpdates.currentChapter !== undefined) {
    payload.currentChapter = safeUpdates.currentChapter;
  }
  if (safeUpdates.initiationYear !== undefined) {
    payload.initiationYear = safeUpdates.initiationYear;
  }
  if (safeUpdates.fieldPrivacy !== undefined) {
    payload.fieldPrivacy = stripUndefined(safeUpdates.fieldPrivacy);
  }
  if (safeUpdates.profilePicture !== undefined) {
    payload.profilePicture = safeUpdates.profilePicture;
  }
  if (safeUpdates.profilePicturePath !== undefined) {
    payload.profilePicturePath = safeUpdates.profilePicturePath;
  }
  if (safeUpdates.cardBackground !== undefined) {
    payload.cardBackground = safeUpdates.cardBackground;
  }
  if (safeUpdates.cardBackgroundPath !== undefined) {
    payload.cardBackgroundPath = safeUpdates.cardBackgroundPath;
  }
  if (safeUpdates.email !== undefined) payload.email = safeUpdates.email;
  if (safeUpdates.inviteCode !== undefined) payload.inviteCode = safeUpdates.inviteCode;

  if (safeUpdates.username) {
    const normalized = normalizeUsername(safeUpdates.username);
    await claimUsername(userId, normalized, previousUsername);
    payload.username = normalized;
  }

  // merge so first-time field fills work even on legacy/partial docs
  await setDoc(doc(database, 'users', userId), stripUndefined(payload), { merge: true });

  // Reload-light milestone: stamp profileCompletedAt when definition first met
  const afterSnap = await getDoc(doc(database, 'users', userId));
  if (afterSnap.exists()) {
    const after = mapUser(afterSnap.id, afterSnap.data());
    const milestone: Record<string, unknown> = {
      'stats.profileUpdates': increment(1),
    };
    if (!after.profileCompletedAt && isProfileComplete(after)) {
      milestone.profileCompletedAt = new Date().toISOString();
      if (after.firstCardImageDownloadedAt && !after.activatedAt) {
        milestone.activatedAt = new Date().toISOString();
      }
    }
    await setDoc(doc(database, 'users', userId), milestone, { merge: true });
  }
}

export async function clearProfilePhoto(userId: string): Promise<void> {
  const database = requireDb();
  await setDoc(
    doc(database, 'users', userId),
    {
      profilePicture: deleteField(),
      profilePicturePath: deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function clearCardBackground(userId: string): Promise<void> {
  const database = requireDb();
  await setDoc(
    doc(database, 'users', userId),
    {
      cardBackground: deleteField(),
      cardBackgroundPath: deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function setUserTier(userId: string, tier: MembershipTier): Promise<void> {
  const database = requireDb();
  await setDoc(
    doc(database, 'users', userId),
    { tier, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function setUserAdmin(userId: string, admin: boolean): Promise<void> {
  const database = requireDb();
  await setDoc(
    doc(database, 'users', userId),
    { admin, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function listUsers(): Promise<UserProfile[]> {
  const database = requireDb();
  const snap = await getDocs(collection(database, 'users'));
  return snap.docs.map((d) => mapUser(d.id, d.data()));
}

export async function listAllInvites(): Promise<InviteRecord[]> {
  const database = requireDb();
  const snap = await getDocs(collection(database, 'invites'));
  return snap.docs.map((d) => mapInvite(d.id, d.data()));
}

export async function listAccountDeletions(): Promise<AccountDeletion[]> {
  const database = requireDb();
  const snap = await getDocs(
    query(collection(database, 'accountDeletions'), orderBy('deletedAt', 'desc'))
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userId: data.userId ?? '',
      username: data.username ?? '',
      email: data.email ?? '',
      name: data.name ?? '',
      chapter: data.chapter ?? '',
      province: typeof data.province === 'string' ? data.province : undefined,
      initiationYear:
        typeof data.initiationYear === 'number' ? data.initiationYear : undefined,
      tier: (data.tier as MembershipTier) ?? 'free',
      wasActivated: Boolean(data.wasActivated),
      deletedAt:
        data.deletedAt ??
        data.createdAt?.toDate?.()?.toISOString?.() ??
        new Date().toISOString(),
    };
  });
}

export async function createInviteForUser(
  user: UserProfile,
  options?: { grantsBasic?: boolean }
): Promise<InviteRecord> {
  const grantsBasic = Boolean(options?.grantsBasic);
  if (grantsBasic && !user.admin) {
    throw new Error('Only admins can create complimentary Basic invites.');
  }

  const database = requireDb();
  const code = createInviteCode();
  const id = `${user.id}_${code}`;
  const createdAt = new Date().toISOString();
  const record: InviteRecord = {
    id,
    code,
    inviterId: user.id,
    inviterName: user.name,
    inviterUsername: user.username,
    inviterChapter: user.chapter,
    inviterInitiationYear: user.initiationYear,
    createdAt,
    active: true,
    grantsBasic,
  };
  await setDoc(doc(database, 'invites', id), {
    code: record.code,
    inviterId: record.inviterId,
    inviterName: record.inviterName,
    inviterUsername: record.inviterUsername,
    inviterChapter: record.inviterChapter,
    inviterInitiationYear: record.inviterInitiationYear,
    createdAt: record.createdAt,
    active: true,
    grantsBasic,
  });
  void bumpOwnStat(user.id, 'invitesCreated').catch(() => {
    /* non-blocking analytics */
  });
  return record;
}

function mapInvite(id: string, data: DocumentData): InviteRecord {
  return {
    id,
    code: data.code ?? '',
    inviterId: data.inviterId ?? '',
    inviterName: data.inviterName ?? '',
    inviterUsername: data.inviterUsername ?? '',
    inviterChapter: data.inviterChapter,
    inviterInitiationYear: data.inviterInitiationYear,
    usedBy: data.usedBy,
    usedAt: data.usedAt,
    createdAt: data.createdAt ?? new Date().toISOString(),
    active: data.active !== false,
    multiUse: Boolean(data.multiUse),
    useCount: typeof data.useCount === 'number' ? data.useCount : 0,
    lastUsedAt: data.lastUsedAt,
    grantsBasic: Boolean(data.grantsBasic),
  };
}

export async function getAdminShareInvite(userId: string): Promise<InviteRecord | null> {
  const database = requireDb();
  const snap = await getDoc(doc(database, 'invites', `${userId}_SHARE`));
  if (!snap.exists()) return null;
  return mapInvite(snap.id, snap.data());
}

/** One reusable chapter share code per admin (create once, toggle active / complimentary anytime). */
export async function createAdminShareInvite(
  user: UserProfile,
  options?: { grantsBasic?: boolean }
): Promise<InviteRecord> {
  if (!user.admin) throw new Error('Only admins can create a chapter share code.');
  const existing = await getAdminShareInvite(user.id);
  if (existing) {
    if (options?.grantsBasic !== undefined && options.grantsBasic !== existing.grantsBasic) {
      return setAdminShareInviteGrantsBasic(user, options.grantsBasic);
    }
    return existing;
  }

  const grantsBasic = Boolean(options?.grantsBasic);
  const database = requireDb();
  const code = createInviteCode();
  const id = `${user.id}_SHARE`;
  const createdAt = new Date().toISOString();
  const record: InviteRecord = {
    id,
    code,
    inviterId: user.id,
    inviterName: user.name,
    inviterUsername: user.username,
    inviterChapter: user.chapter,
    inviterInitiationYear: user.initiationYear,
    createdAt,
    active: true,
    multiUse: true,
    useCount: 0,
    grantsBasic,
  };
  await setDoc(doc(database, 'invites', id), {
    code: record.code,
    inviterId: record.inviterId,
    inviterName: record.inviterName,
    inviterUsername: record.inviterUsername,
    inviterChapter: record.inviterChapter,
    inviterInitiationYear: record.inviterInitiationYear,
    createdAt: record.createdAt,
    active: true,
    multiUse: true,
    useCount: 0,
    grantsBasic,
  });
  void bumpOwnStat(user.id, 'invitesCreated').catch(() => {
    /* non-blocking analytics */
  });
  return record;
}

/** Toggle whether the admin chapter share code unlocks Basic for free. */
export async function setAdminShareInviteGrantsBasic(
  user: UserProfile,
  grantsBasic: boolean
): Promise<InviteRecord> {
  if (!user.admin) throw new Error('Only admins can update complimentary invite settings.');
  const existing = await getAdminShareInvite(user.id);
  if (!existing) throw new Error('Create a chapter share code first.');

  const database = requireDb();
  await updateDoc(doc(database, 'invites', existing.id), { grantsBasic: Boolean(grantsBasic) });
  return { ...existing, grantsBasic: Boolean(grantsBasic) };
}

export async function getInvitesForUser(userId: string): Promise<InviteRecord[]> {
  const database = requireDb();
  const invitesQuery = query(collection(database, 'invites'), where('inviterId', '==', userId));
  const snap = await getDocs(invitesQuery);
  const invites = snap.docs.map((d) => mapInvite(d.id, d.data()));
  return invites.sort((a, b) => {
    const aTime = Date.parse(a.createdAt) || 0;
    const bTime = Date.parse(b.createdAt) || 0;
    return bTime - aTime;
  });
}

/** Soft-delete: mark invite inactive so it can no longer be redeemed. */
export async function deactivateInvite(inviteId: string, userId: string): Promise<void> {
  await setInviteActive(inviteId, userId, false);
}

/** Enable or disable an invite you own. Used one-time codes cannot be reactivated. */
export async function setInviteActive(
  inviteId: string,
  userId: string,
  active: boolean
): Promise<void> {
  const database = requireDb();
  const ref = doc(database, 'invites', inviteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Invite not found.');
  const data = snap.data();
  if (data.inviterId !== userId) throw new Error('You can only update your own invites.');
  if (!data.multiUse && data.usedBy) {
    throw new Error('This invite was already used and cannot be changed.');
  }
  if (data.active === active) return;
  await updateDoc(ref, { active });
}

export function canUseCardFeatures(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  if (user.admin) return true;
  return user.tier === 'basic' || user.tier === 'premium';
}

/**
 * Reauthenticate before sensitive Auth operations (delete, etc.).
 * Password accounts need `password`; Google accounts get a popup.
 */
async function reauthenticateForSensitiveAction(
  authUser: User,
  options?: { password?: string }
): Promise<void> {
  const providers = authUser.providerData.map((p) => p.providerId);

  if (providers.includes('password')) {
    if (!authUser.email) throw new Error('Your account has no email address.');
    if (!options?.password?.trim()) {
      throw new Error('Enter your password to confirm account deletion.');
    }
    const credential = EmailAuthProvider.credential(authUser.email, options.password);
    await reauthenticateWithCredential(authUser, credential);
    return;
  }

  if (providers.includes('google.com')) {
    await reauthenticateWithPopup(authUser, googleProvider);
    return;
  }

  throw new Error('Re-sign in with your original provider, then try deleting again.');
}

/**
 * Permanently delete the signed-in member's Auth account and related data.
 * Reauthenticates first so Auth deletion cannot fail after Firestore is wiped.
 */
export async function deleteMyAccount(
  user: UserProfile,
  options?: { password?: string }
): Promise<void> {
  if (!auth?.currentUser) throw new Error('You must be signed in to delete your account.');
  if (auth.currentUser.uid !== user.id) {
    throw new Error('You can only delete your own account.');
  }

  const database = requireDb();
  const uid = user.id;
  const authUser = auth.currentUser;
  const deletedAt = new Date().toISOString();

  // Must succeed before any destructive deletes — otherwise Auth orphans keep the email "taken"
  try {
    await reauthenticateForSensitiveAction(authUser, options);
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      throw new Error('Incorrect password. Try again.');
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new Error('Google confirmation was cancelled. Try again to delete your account.');
    }
    throw err instanceof Error ? err : new Error('Could not verify your identity.');
  }

  // Log deletion for admin analytics before wiping identity (survives account removal)
  await addDoc(collection(database, 'accountDeletions'), {
    userId: uid,
    username: user.username,
    email: user.email,
    name: user.name,
    chapter: user.chapter,
    province: user.province || null,
    initiationYear: user.initiationYear || null,
    tier: user.tier,
    wasActivated: Boolean(user.activatedAt),
    deletedAt,
    createdAt: serverTimestamp(),
  });

  // Username aliases (current + historical) — parallel with invite cleanup prep
  const [aliasSnap, invites] = await Promise.all([
    getDocs(query(collection(database, 'usernames'), where('userId', '==', uid))),
    getInvitesForUser(uid),
  ]);

  const aliasDeletes = aliasSnap.docs.map((d) => deleteDoc(d.ref));
  if (user.username) {
    const currentAlias = doc(database, 'usernames', normalizeUsername(user.username));
    aliasDeletes.push(
      getDoc(currentAlias).then((snap) => (snap.exists() ? deleteDoc(currentAlias) : undefined))
    );
  }

  await Promise.all([
    ...aliasDeletes,
    ...invites.map((invite) => deleteDoc(doc(database, 'invites', invite.id))),
    deleteAllCollectedCards(uid),
  ]);

  // Profile photos in Storage
  if (storage) {
    try {
      if (user.profilePicturePath) {
        await deleteObject(ref(storage, user.profilePicturePath));
      }
      if (user.cardBackgroundPath) {
        await deleteObject(ref(storage, user.cardBackgroundPath));
      }
    } catch {
      /* missing object is fine */
    }
    try {
      const folder = ref(storage, `profile-pictures/${uid}`);
      const listed = await listAll(folder);
      await Promise.all(listed.items.map((item) => deleteObject(item)));
    } catch {
      /* folder may be empty */
    }
  }

  // Profile document (must stay authenticated until Auth delete)
  await deleteDoc(doc(database, 'users', uid));

  try {
    await deleteUser(authUser);
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
    if (code === 'auth/requires-recent-login') {
      throw new Error(
        'Your profile data was removed, but authentication could not be deleted. In Firebase Console → Authentication, delete this email manually, then contact support if needed.'
      );
    }
    throw err instanceof Error ? err : new Error('Could not delete authentication account.');
  }
}
