import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { upsertBrotherFromEncounter, upsertBrotherFromQr } from './brothers';
import { isLikelyBotOrPreviewAgent } from './bots';
import { db } from './firebase';
import { qrDevLog } from './qrDevLog';
import { getUserById } from './users';
import type { Encounter, EncounterSource, UserProfile } from '../types';

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
  | { status: 'created'; encounterId?: string; brotherId?: string }
  | { status: 'skipped'; reason: 'self' | 'bot' | 'deduped' | 'not_qr' };

/**
 * Record a QR-origin card visit (background, no UI).
 * Authenticated: upserts Brothers. Anonymous: writes encounters for claim-on-login.
 * Direct profile views must not call this (they stay analytics-only).
 */
export async function recordQrEncounter(input: {
  ownerId: string;
  viewerId?: string | null;
  source?: EncounterSource;
  /** Preferred for authenticated upserts — avoids an extra profile fetch */
  subject?: UserProfile | null;
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

  // Signed-in: person-centric Brothers upsert (no list-facing encounters doc)
  if (viewerId) {
    qrDevLog('Upserting Brother from authenticated QR visit.', {
      ownerId,
      viewerId,
      timestamp: now,
    });
    try {
      const subject = input.subject ?? (await getUserById(ownerId));
      if (!subject) {
        clearRecorded(ownerId, scanner);
        throw new Error('Card owner profile not found.');
      }
      await upsertBrotherFromQr(viewerId, subject);
      qrDevLog('Brother upserted from QR.', { ownerId, viewerId });
      return { status: 'created', brotherId: ownerId };
    } catch (err) {
      clearRecorded(ownerId, scanner);
      qrDevLog('Brother QR upsert failed (profile/vCard unaffected).', err);
      throw err;
    }
  }

  // Anonymous: short-lived encounters doc for claim-on-login
  const payload: Record<string, unknown> = {
    ownerId,
    timestamp: now,
    source: 'qr',
    createdAt: now,
    updatedAt: now,
    anonymousSessionId: getOrCreateAnonymousSessionId(),
  };

  qrDevLog('Creating anonymous Encounter from QR visit.', {
    ownerId,
    anonymous: true,
    timestamp: now,
    source: 'qr',
  });

  try {
    const ref = await addDoc(collection(requireDb(), 'encounters'), payload);
    qrDevLog('Anonymous Encounter created.', { encounterId: ref.id, ownerId });
    return { status: 'created', encounterId: ref.id };
  } catch (err) {
    clearRecorded(ownerId, scanner);
    qrDevLog('Encounter create failed (profile/vCard unaffected).', err);
    throw err;
  }
}

/** Attach anonymous encounters from this browser into Brothers for the signed-in user. */
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

      const encounter = mapEncounter(d.id, data);
      const subject = await getUserById(encounter.ownerId);
      if (subject) {
        await upsertBrotherFromEncounter(uid, subject, encounter);
      }

      await updateDoc(d.ref, {
        viewerId: uid,
        claimedAt: now,
        updatedAt: now,
      });
      claimed += 1;
    })
  );

  if (claimed > 0) {
    qrDevLog('Claimed anonymous encounters into Brothers.', { userId: uid, claimed });
  }

  return claimed;
}

/**
 * Backfill: merge any viewer encounters into Brothers rows (legacy Met data).
 * Safe to call on every Brothers list load.
 */
export async function mergeMyEncountersIntoBrothers(viewerId: string): Promise<number> {
  const uid = viewerId?.trim();
  if (!uid) return 0;

  let encounters: Encounter[] = [];
  try {
    encounters = await listMyEncounters(uid);
  } catch {
    // Index still building or rules — skip backfill quietly
    return 0;
  }

  let merged = 0;
  for (const encounter of encounters) {
    if (!encounter.ownerId || encounter.ownerId === uid) continue;
    try {
      const subject = await getUserById(encounter.ownerId);
      if (!subject) continue;
      await upsertBrotherFromEncounter(uid, subject, encounter);
      merged += 1;
    } catch {
      // continue with other rows
    }
  }
  return merged;
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

export function mapEncounterDoc(id: string, data: DocumentData): Encounter {
  return mapEncounter(id, data);
}
