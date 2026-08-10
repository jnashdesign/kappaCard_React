import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { isLikelyBotOrPreviewAgent } from './bots';
import { db } from './firebase';
import { qrDevLog } from './qrDevLog';
import type { Encounter, EncounterSource } from '../types';

const ANON_SESSION_KEY = 'kappa:anonSession';
const ENCOUNTER_DEDUPE_MS = 15 * 60 * 1000; // 15 minutes

function requireDb() {
  if (!db) throw new Error('Firebase is not configured. Add your VITE_FIREBASE_* env vars.');
  return db;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

/** Opaque browser session id for anonymous encounter claim (localStorage, not fingerprints). */
export function getOrCreateAnonymousSessionId(): string {
  try {
    const existing = localStorage.getItem(ANON_SESSION_KEY)?.trim();
    if (existing && existing.length >= 8 && existing.length <= 128) return existing;
    const id = newId();
    localStorage.setItem(ANON_SESSION_KEY, id);
    return id;
  } catch {
    return newId();
  }
}

function peekAnonymousSessionId(): string | null {
  try {
    const existing = localStorage.getItem(ANON_SESSION_KEY)?.trim();
    if (existing && existing.length >= 8 && existing.length <= 128) return existing;
  } catch {
    // ignore
  }
  return null;
}

function scannerKey(viewerId?: string | null): string {
  if (viewerId) return `u:${viewerId}`;
  return `a:${getOrCreateAnonymousSessionId()}`;
}

function dedupeStorageKey(ownerId: string, scanner: string): string {
  return `kappa:encounter:${ownerId}:${scanner}`;
}

function wasRecentlyRecorded(ownerId: string, scanner: string): boolean {
  try {
    const raw = sessionStorage.getItem(dedupeStorageKey(ownerId, scanner));
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < ENCOUNTER_DEDUPE_MS;
  } catch {
    return false;
  }
}

function markRecorded(ownerId: string, scanner: string): void {
  try {
    sessionStorage.setItem(dedupeStorageKey(ownerId, scanner), String(Date.now()));
  } catch {
    // ignore
  }
}

function clearRecorded(ownerId: string, scanner: string): void {
  try {
    sessionStorage.removeItem(dedupeStorageKey(ownerId, scanner));
  } catch {
    // ignore
  }
}

function mapEncounter(id: string, data: DocumentData): Encounter {
  return {
    id,
    ownerId: String(data.ownerId ?? ''),
    viewerId: typeof data.viewerId === 'string' ? data.viewerId : null,
    anonymousSessionId:
      typeof data.anonymousSessionId === 'string' ? data.anonymousSessionId : null,
    timestamp: typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString(),
    source: (typeof data.source === 'string' ? data.source : 'qr') as EncounterSource,
    event: typeof data.event === 'string' ? data.event : undefined,
    location: typeof data.location === 'string' ? data.location : undefined,
    privateNote: typeof data.privateNote === 'string' ? data.privateNote : undefined,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
    claimedAt: typeof data.claimedAt === 'string' ? data.claimedAt : undefined,
  };
}

export type RecordEncounterResult =
  | { status: 'created'; encounterId: string }
  | { status: 'skipped'; reason: 'self' | 'bot' | 'deduped' | 'not_qr' };

/**
 * Create an Encounter for a QR-origin card visit (background, no UI).
 * Direct profile views must not call this (they stay analytics-only).
 */
export async function recordQrEncounter(input: {
  ownerId: string;
  viewerId?: string | null;
  source?: EncounterSource;
}): Promise<RecordEncounterResult> {
  const ownerId = input.ownerId?.trim();
  if (!ownerId) throw new Error('ownerId is required.');

  const source: EncounterSource = input.source ?? 'qr';
  if (source !== 'qr') {
    qrDevLog('Encounter skipped: not a QR visit.', { ownerId, source });
    return { status: 'skipped', reason: 'not_qr' };
  }

  if (isLikelyBotOrPreviewAgent()) {
    qrDevLog('Encounter skipped: bot/crawler/preview agent.', { ownerId });
    return { status: 'skipped', reason: 'bot' };
  }

  const viewerId = input.viewerId?.trim() || null;
  if (viewerId && viewerId === ownerId) {
    qrDevLog('Encounter skipped: viewer is card owner (self).', { ownerId });
    return { status: 'skipped', reason: 'self' };
  }

  const scanner = scannerKey(viewerId);
  if (wasRecentlyRecorded(ownerId, scanner)) {
    qrDevLog('Encounter skipped: duplicate within short window.', {
      ownerId,
      scanner: viewerId ? `user:${viewerId}` : 'anonymous',
    });
    return { status: 'skipped', reason: 'deduped' };
  }

  markRecorded(ownerId, scanner);

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    ownerId,
    timestamp: now,
    source: 'qr',
    createdAt: now,
    updatedAt: now,
  };

  if (viewerId) {
    payload.viewerId = viewerId;
  } else {
    payload.anonymousSessionId = getOrCreateAnonymousSessionId();
  }

  qrDevLog('Creating Encounter from QR visit.', {
    ownerId,
    viewerId: viewerId ?? null,
    anonymous: !viewerId,
    timestamp: now,
    source: 'qr',
  });

  try {
    const ref = await addDoc(collection(requireDb(), 'encounters'), payload);
    qrDevLog('Encounter created.', { encounterId: ref.id, ownerId, viewerId: viewerId ?? null });
    return { status: 'created', encounterId: ref.id };
  } catch (err) {
    clearRecorded(ownerId, scanner);
    qrDevLog('Encounter create failed (profile/vCard unaffected).', err);
    throw err;
  }
}

/** Attach anonymous encounters from this browser to the signed-in user. */
export async function claimAnonymousEncounters(userId: string): Promise<number> {
  const uid = userId?.trim();
  if (!uid) return 0;

  const sessionId = peekAnonymousSessionId();
  if (!sessionId) return 0;

  const database = requireDb();
  const snap = await getDocs(
    query(collection(database, 'encounters'), where('anonymousSessionId', '==', sessionId))
  );

  const now = new Date().toISOString();
  let claimed = 0;

  await Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data();
      if (typeof data.viewerId === 'string' && data.viewerId) return;
      if (data.ownerId === uid) return;

      await updateDoc(d.ref, {
        viewerId: uid,
        claimedAt: now,
        updatedAt: now,
      });
      claimed += 1;
    })
  );

  if (claimed > 0) {
    qrDevLog('Claimed anonymous encounters for signed-in user.', { userId: uid, claimed });
  }

  return claimed;
}

/** Encounters where the signed-in user was the scanner, newest first. */
export async function listMyEncounters(viewerId: string): Promise<Encounter[]> {
  const uid = viewerId?.trim();
  if (!uid) return [];

  const snap = await getDocs(
    query(
      collection(requireDb(), 'encounters'),
      where('viewerId', '==', uid),
      orderBy('timestamp', 'desc')
    )
  );

  return snap.docs.map((d) => mapEncounter(d.id, d.data()));
}

/** Load one encounter; caller must be the viewer (enforced by rules). */
export async function getEncounter(encounterId: string): Promise<Encounter | null> {
  const id = encounterId?.trim();
  if (!id) return null;
  const snap = await getDoc(doc(requireDb(), 'encounters', id));
  if (!snap.exists()) return null;
  return mapEncounter(snap.id, snap.data());
}

export type EncounterContextUpdate = {
  event?: string;
  location?: string;
  privateNote?: string;
};

/**
 * Update the scanner's private meeting context on their encounter.
 * Empty strings clear the field. Never written to the brother's public profile.
 */
export async function updateEncounterContext(
  encounterId: string,
  updates: EncounterContextUpdate
): Promise<void> {
  const id = encounterId?.trim();
  if (!id) throw new Error('Encounter id is required.');

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

  await updateDoc(doc(requireDb(), 'encounters', id), payload);
}

export function mapEncounterDoc(id: string, data: DocumentData): Encounter {
  return mapEncounter(id, data);
}
