import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  setDoc,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { toPublicProfile } from './privacy';
import type { BrotherRecord, Encounter, UserProfile } from '../types';

function requireDb() {
  if (!db) throw new Error('Firebase is not configured. Add your VITE_FIREBASE_* env vars.');
  return db;
}

function brotherRef(viewerId: string, subjectUserId: string) {
  return doc(requireDb(), 'users', viewerId, 'collectedCards', subjectUserId);
}

function maxIso(a?: string | null, b?: string | null): string | undefined {
  if (!a) return b || undefined;
  if (!b) return a;
  return a >= b ? a : b;
}

function minIso(a?: string | null, b?: string | null): string | undefined {
  if (!a) return b || undefined;
  if (!b) return a;
  return a <= b ? a : b;
}

function snapshotFields(subject: UserProfile) {
  const publicSubject = toPublicProfile(subject);
  return {
    subjectUserId: subject.id,
    username: publicSubject.username,
    name: publicSubject.name,
    chapter: publicSubject.chapter,
    initiationYear: publicSubject.initiationYear,
    profilePicture: publicSubject.profilePicture || null,
    occupation: publicSubject.occupation || null,
    currentCity: publicSubject.currentCity || null,
  };
}

export function mapBrotherRecord(id: string, data: DocumentData): BrotherRecord {
  const collectedAt =
    typeof data.collectedAt === 'string' ? data.collectedAt : undefined;
  const savedContactAt =
    typeof data.savedContactAt === 'string'
      ? data.savedContactAt
      : collectedAt;
  const lastMetAt = typeof data.lastMetAt === 'string' ? data.lastMetAt : undefined;
  const legacySource = typeof data.source === 'string' ? data.source : undefined;
  const metViaQr =
    typeof data.metViaQr === 'boolean'
      ? data.metViaQr
      : Boolean(lastMetAt);
  const savedContact =
    typeof data.savedContact === 'boolean'
      ? data.savedContact
      : legacySource === 'vcard_download' || Boolean(savedContactAt && !metViaQr) || Boolean(collectedAt);

  const firstActivityAt =
    (typeof data.firstActivityAt === 'string' && data.firstActivityAt) ||
    minIso(lastMetAt, savedContactAt) ||
    collectedAt ||
    new Date().toISOString();
  const lastActivityAt =
    (typeof data.lastActivityAt === 'string' && data.lastActivityAt) ||
    maxIso(lastMetAt, savedContactAt) ||
    collectedAt ||
    firstActivityAt;

  return {
    id,
    subjectUserId: typeof data.subjectUserId === 'string' ? data.subjectUserId : id,
    username: typeof data.username === 'string' ? data.username : '',
    name: typeof data.name === 'string' ? data.name : '',
    chapter: typeof data.chapter === 'string' ? data.chapter : '',
    initiationYear:
      typeof data.initiationYear === 'number' ? data.initiationYear : new Date().getFullYear(),
    profilePicture: typeof data.profilePicture === 'string' ? data.profilePicture : undefined,
    occupation: typeof data.occupation === 'string' ? data.occupation : undefined,
    currentCity: typeof data.currentCity === 'string' ? data.currentCity : undefined,
    metViaQr,
    savedContact: savedContact || (!metViaQr && Boolean(collectedAt)),
    lastMetAt,
    savedContactAt: savedContact ? savedContactAt : undefined,
    firstActivityAt,
    lastActivityAt,
    event: typeof data.event === 'string' ? data.event : undefined,
    location: typeof data.location === 'string' ? data.location : undefined,
    privateNote: typeof data.privateNote === 'string' ? data.privateNote : undefined,
    collectedAt,
    source: legacySource,
  };
}

type UpsertKind = 'qr' | 'vcard';

async function upsertBrother(
  viewerId: string,
  subject: UserProfile,
  kind: UpsertKind,
  extras?: { event?: string; location?: string; privateNote?: string; activityAt?: string }
): Promise<void> {
  if (!viewerId || viewerId === subject.id) return;

  const now = extras?.activityAt || new Date().toISOString();
  const ref = brotherRef(viewerId, subject.id);
  const existing = await getDoc(ref);
  const prev = existing.exists() ? mapBrotherRecord(existing.id, existing.data()) : null;

  const metViaQr = kind === 'qr' ? true : Boolean(prev?.metViaQr);
  const savedContact = kind === 'vcard' ? true : Boolean(prev?.savedContact);
  const lastMetAt = kind === 'qr' ? now : prev?.lastMetAt;
  const savedContactAt = kind === 'vcard' ? now : prev?.savedContactAt;
  const firstActivityAt = prev?.firstActivityAt || now;
  const lastActivityAt = maxIso(prev?.lastActivityAt, now) || now;

  const payload: Record<string, unknown> = {
    ...snapshotFields(subject),
    metViaQr,
    savedContact,
    firstActivityAt,
    lastActivityAt,
    updatedAt: now,
  };

  if (lastMetAt) payload.lastMetAt = lastMetAt;
  if (savedContactAt) {
    payload.savedContactAt = savedContactAt;
    payload.collectedAt = savedContactAt;
  }
  if (kind === 'vcard') {
    payload.source = 'vcard_download';
  }

  // Prefer existing notes unless extras provide newer non-empty values (used by encounter merge)
  if (extras) {
    if (extras.event?.trim()) payload.event = extras.event.trim().slice(0, 200);
    if (extras.location?.trim()) payload.location = extras.location.trim().slice(0, 200);
    if (extras.privateNote?.trim()) payload.privateNote = extras.privateNote.trim().slice(0, 2000);
  }

  await setDoc(ref, payload, { merge: true });
}

/** Upsert brother after authenticated QR scan. */
export async function upsertBrotherFromQr(
  viewerId: string,
  subject: UserProfile
): Promise<void> {
  await upsertBrother(viewerId, subject, 'qr');
}

/** Upsert brother after Save to Contacts (also exported as saveCollectedCard). */
export async function upsertBrotherFromVCard(
  viewerId: string,
  subject: UserProfile
): Promise<void> {
  await upsertBrother(viewerId, subject, 'vcard');
}

/** @deprecated Prefer upsertBrotherFromVCard */
export async function saveCollectedCard(
  collectorId: string,
  subject: UserProfile
): Promise<void> {
  await upsertBrotherFromVCard(collectorId, subject);
}

/**
 * Merge an encounter into the viewer's brother row (claim / backfill).
 * Newest activity wins; non-empty notes from encounter fill empty brother fields,
 * or overwrite when encounter timestamp is newer than brother lastActivityAt.
 */
export async function upsertBrotherFromEncounter(
  viewerId: string,
  subject: UserProfile,
  encounter: Pick<Encounter, 'timestamp' | 'event' | 'location' | 'privateNote' | 'source'>
): Promise<void> {
  if (!viewerId || viewerId === subject.id) return;

  const now = encounter.timestamp || new Date().toISOString();
  const ref = brotherRef(viewerId, subject.id);
  const existing = await getDoc(ref);
  const prev = existing.exists() ? mapBrotherRecord(existing.id, existing.data()) : null;

  const encounterNewer =
    !prev?.lastActivityAt || now >= prev.lastActivityAt;

  const extras: {
    event?: string;
    location?: string;
    privateNote?: string;
    activityAt: string;
  } = { activityAt: now };

  if (encounterNewer) {
    if (encounter.event?.trim()) extras.event = encounter.event;
    if (encounter.location?.trim()) extras.location = encounter.location;
    if (encounter.privateNote?.trim()) extras.privateNote = encounter.privateNote;
  } else {
    if (!prev?.event && encounter.event?.trim()) extras.event = encounter.event;
    if (!prev?.location && encounter.location?.trim()) extras.location = encounter.location;
    if (!prev?.privateNote && encounter.privateNote?.trim()) {
      extras.privateNote = encounter.privateNote;
    }
  }

  const kind: UpsertKind =
    encounter.source === 'qr' || !prev?.savedContact ? 'qr' : 'qr';
  // Always mark met via QR for encounter-sourced merges; preserve savedContact via merge read
  await upsertBrother(viewerId, subject, kind, extras);
}

export async function getBrother(
  viewerId: string,
  subjectUserId: string
): Promise<BrotherRecord | null> {
  const uid = viewerId?.trim();
  const subjectId = subjectUserId?.trim();
  if (!uid || !subjectId) return null;
  const snap = await getDoc(brotherRef(uid, subjectId));
  if (!snap.exists()) return null;
  return mapBrotherRecord(snap.id, snap.data());
}

export async function listBrothers(viewerId: string): Promise<BrotherRecord[]> {
  const uid = viewerId?.trim();
  if (!uid) return [];

  const snap = await getDocs(collection(requireDb(), 'users', uid, 'collectedCards'));
  const rows = snap.docs.map((d) => mapBrotherRecord(d.id, d.data()));
  rows.sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1));
  return rows;
}

/** @deprecated Prefer listBrothers */
export async function listCollectedCards(collectorId: string): Promise<BrotherRecord[]> {
  return listBrothers(collectorId);
}

export type BrotherContextUpdate = {
  event?: string;
  location?: string;
  privateNote?: string;
};

export async function updateBrotherContext(
  viewerId: string,
  subjectUserId: string,
  updates: BrotherContextUpdate
): Promise<void> {
  const uid = viewerId?.trim();
  const subjectId = subjectUserId?.trim();
  if (!uid || !subjectId) throw new Error('Brother ids are required.');

  const payload: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if ('event' in updates) {
    const value = updates.event?.trim() ?? '';
    payload.event = value ? value.slice(0, 200) : deleteField();
  }
  if ('location' in updates) {
    const value = updates.location?.trim() ?? '';
    payload.location = value ? value.slice(0, 200) : deleteField();
  }
  if ('privateNote' in updates) {
    const value = updates.privateNote?.trim() ?? '';
    payload.privateNote = value ? value.slice(0, 2000) : deleteField();
  }

  await setDoc(brotherRef(uid, subjectId), payload, { merge: true });
}

export async function removeBrother(viewerId: string, subjectUserId: string): Promise<void> {
  await deleteDoc(brotherRef(viewerId, subjectUserId));
}

/** @deprecated Prefer removeBrother */
export async function removeCollectedCard(
  collectorId: string,
  subjectUserId: string
): Promise<void> {
  await removeBrother(collectorId, subjectUserId);
}

/** Wipe the viewer's brother rows during account deletion. */
export async function deleteAllBrothers(viewerId: string): Promise<void> {
  const database = requireDb();
  const snap = await getDocs(collection(database, 'users', viewerId, 'collectedCards'));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

/** @deprecated Prefer deleteAllBrothers */
export async function deleteAllCollectedCards(collectorId: string): Promise<void> {
  await deleteAllBrothers(collectorId);
}
