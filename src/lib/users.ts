import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import type { FieldPrivacy, InviteRecord, MembershipTier, UserProfile } from '../types';
import { normalizeFieldPrivacy } from './privacy';
import { sanitizePhotoUrl } from './photos';
import { createInviteCode, normalizeUsername, validateUsername } from './username';

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
    profilePicture: sanitizePhotoUrl(data.profilePicture),
    profilePicturePath: typeof data.profilePicturePath === 'string' ? data.profilePicturePath : undefined,
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

  const aliasSnap = await getDoc(doc(database, 'usernames', normalized));
  if (aliasSnap.exists()) {
    return aliasSnap.data().userId === excludeUserId;
  }

  const usersQuery = query(collection(database, 'users'), where('username', '==', normalized));
  const usersSnap = await getDocs(usersQuery);
  if (usersSnap.empty) return true;
  return usersSnap.docs.every((d) => d.id === excludeUserId);
}

export async function claimUsername(userId: string, username: string, previousUsername?: string): Promise<void> {
  const database = requireDb();
  const normalized = normalizeUsername(username);
  const error = validateUsername(normalized);
  if (error) throw new Error(error);

  const available = await isUsernameAvailable(normalized, userId);
  if (!available) throw new Error('That username is already taken.');

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
    socialMedia: {},
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(database, 'users', userId), {
    ...profile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await claimUsername(userId, username);

  // Personal invite code document for this new user (unused until they invite someone)
  await setDoc(doc(database, 'invites', `${userId}_${personalInviteCode}`), {
    code: personalInviteCode,
    inviterId: userId,
    inviterName: profile.name,
    inviterUsername: username,
    inviterChapter: profile.chapter,
    inviterInitiationYear: profile.initiationYear,
    active: true,
    createdAt: now,
    grantsBasic: false,
  });

  if (inviteDocId) {
    const inviteRef = doc(database, 'invites', inviteDocId);
    const inviteSnap = await getDoc(inviteRef);
    const inviteData = inviteSnap.data() as InviteRecord | undefined;

    if (inviteData?.multiUse) {
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

  // Never let the client escalate privileges through profile save
  const {
    id: _id,
    admin: _admin,
    tier: _tier,
    invitedBy: _invitedBy,
    invitedByUsername: _invitedByUsername,
    invitedByName: _invitedByName,
    invitedByChapter: _invitedByChapter,
    invitedByInitiationYear: _invitedByInitiationYear,
    ...safeUpdates
  } = updates;

const payload: Record<string, unknown> = stripUndefined({
    ...safeUpdates,
    updatedAt: serverTimestamp(),
  });
  delete payload.id;

  if (safeUpdates.username) {
    const normalized = normalizeUsername(safeUpdates.username);
    await claimUsername(userId, normalized, previousUsername);
    payload.username = normalized;
  }

  // merge so first-time field fills work even on legacy/partial docs
  await setDoc(doc(database, 'users', userId), payload, { merge: true });
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
