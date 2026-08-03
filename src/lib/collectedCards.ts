import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { toPublicProfile } from './privacy';
import type { CollectedCard, UserProfile } from '../types';

function requireDb() {
  if (!db) throw new Error('Firebase is not configured. Add your VITE_FIREBASE_* env vars.');
  return db;
}

function collectedRef(collectorId: string, subjectUserId: string) {
  return doc(requireDb(), 'users', collectorId, 'collectedCards', subjectUserId);
}

function mapCollectedCard(id: string, data: DocumentData): CollectedCard {
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
    collectedAt: typeof data.collectedAt === 'string' ? data.collectedAt : new Date().toISOString(),
    source: 'vcard_download',
  };
}

/**
 * Upsert a thin public preview of another brother's card after Save to Contacts.
 * Doc id = subject uid so re-downloads update the same row.
 */
export async function saveCollectedCard(
  collectorId: string,
  subject: UserProfile
): Promise<void> {
  if (collectorId === subject.id) return;

  const publicSubject = toPublicProfile(subject);
  const now = new Date().toISOString();

  await setDoc(
    collectedRef(collectorId, subject.id),
    {
      subjectUserId: subject.id,
      username: publicSubject.username,
      name: publicSubject.name,
      chapter: publicSubject.chapter,
      initiationYear: publicSubject.initiationYear,
      profilePicture: publicSubject.profilePicture || null,
      occupation: publicSubject.occupation || null,
      currentCity: publicSubject.currentCity || null,
      collectedAt: now,
      source: 'vcard_download',
    },
    { merge: true }
  );
}

export async function listCollectedCards(collectorId: string): Promise<CollectedCard[]> {
  const database = requireDb();
  const snap = await getDocs(
    query(collection(database, 'users', collectorId, 'collectedCards'), orderBy('collectedAt', 'desc'))
  );
  return snap.docs.map((d) => mapCollectedCard(d.id, d.data()));
}

export async function removeCollectedCard(
  collectorId: string,
  subjectUserId: string
): Promise<void> {
  await deleteDoc(collectedRef(collectorId, subjectUserId));
}

/** Wipe the collector's bookmarks during account deletion. */
export async function deleteAllCollectedCards(collectorId: string): Promise<void> {
  const database = requireDb();
  const snap = await getDocs(collection(database, 'users', collectorId, 'collectedCards'));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}
