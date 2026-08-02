import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { createInviteForUser } from './users';
import type { InviteRequest, InviteRequestStatus, UserProfile } from '../types';

function requireDb() {
  if (!db) throw new Error('Firebase is not configured. Add your VITE_FIREBASE_* env vars.');
  return db;
}

export async function submitInviteRequest(input: {
  name: string;
  chapter: string;
  initiationYear: number;
  email: string;
}): Promise<void> {
  const database = requireDb();
  const name = input.name.trim();
  const chapter = input.chapter.trim();
  const email = input.email.trim().toLowerCase();
  const year = Number(input.initiationYear);

  if (name.length < 2) throw new Error('Please enter your full name.');
  if (chapter.length < 2) throw new Error('Please enter your chapter of initiation.');
  if (!Number.isFinite(year) || year < 1911 || year > new Date().getFullYear()) {
    throw new Error('Please enter a valid initiation year.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please enter a valid email address.');
  }

  await addDoc(collection(database, 'inviteRequests'), {
    name,
    chapter,
    initiationYear: year,
    email,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
}

export async function listInviteRequests(): Promise<InviteRequest[]> {
  const database = requireDb();
  const snap = await getDocs(
    query(collection(database, 'inviteRequests'), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name ?? '',
      chapter: data.chapter ?? '',
      initiationYear: Number(data.initiationYear) || new Date().getFullYear(),
      email: data.email ?? '',
      status: (data.status as InviteRequestStatus) ?? 'pending',
      createdAt: data.createdAt ?? '',
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? data.updatedAt,
      reviewedAt: data.reviewedAt,
      inviteCode: data.inviteCode,
    };
  });
}

export async function setInviteRequestStatus(
  requestId: string,
  status: Exclude<InviteRequestStatus, 'pending'>,
  inviteCode?: string
): Promise<void> {
  const database = requireDb();
  await updateDoc(doc(database, 'inviteRequests', requestId), {
    status,
    reviewedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
    ...(inviteCode ? { inviteCode } : {}),
  });
}

/** Approve a request: create a one-time invite and return the signup link. */
export async function approveInviteRequest(
  admin: UserProfile,
  request: InviteRequest,
  options?: { grantsBasic?: boolean }
): Promise<{ code: string; signupUrl: string; grantsBasic: boolean }> {
  const grantsBasic = Boolean(options?.grantsBasic);
  const invite = await createInviteForUser(admin, { grantsBasic });
  await setInviteRequestStatus(request.id, 'approved', invite.code);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return {
    code: invite.code,
    signupUrl: `${origin}/signup?invite=${invite.code}`,
    grantsBasic,
  };
}
