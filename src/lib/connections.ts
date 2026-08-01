import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { ConnectionRequest, ConnectionStatus, UserProfile } from '../types';

function requireDb() {
  if (!db) throw new Error('Firebase is not configured.');
  return db;
}

function mapRequest(id: string, data: Record<string, unknown>): ConnectionRequest {
  return {
    id,
    fromUserId: String(data.fromUserId ?? ''),
    toUserId: String(data.toUserId ?? ''),
    fromName: String(data.fromName ?? ''),
    fromUsername: String(data.fromUsername ?? ''),
    toName: String(data.toName ?? ''),
    toUsername: String(data.toUsername ?? ''),
    status: (data.status as ConnectionStatus) ?? 'pending',
    createdAt: String(data.createdAt ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
  };
}

export async function sendConnectionRequest(from: UserProfile, to: UserProfile): Promise<void> {
  const database = requireDb();
  if (from.id === to.id) throw new Error('You cannot connect with yourself.');

  const existing = query(
    collection(database, 'connectionRequests'),
    where('fromUserId', '==', from.id),
    where('toUserId', '==', to.id)
  );
  const snap = await getDocs(existing);
  const open = snap.docs.find((d) => {
    const status = d.data().status;
    return status === 'pending' || status === 'accepted';
  });
  if (open) throw new Error('A connection request already exists.');

  const now = new Date().toISOString();
  await addDoc(collection(database, 'connectionRequests'), {
    fromUserId: from.id,
    toUserId: to.id,
    fromName: from.name,
    fromUsername: from.username,
    toName: to.name,
    toUsername: to.username,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });
}

export function listenIncomingRequests(
  userId: string,
  onChange: (requests: ConnectionRequest[]) => void
): Unsubscribe {
  const database = requireDb();
  const q = query(
    collection(database, 'connectionRequests'),
    where('toUserId', '==', userId),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => mapRequest(d.id, d.data())));
  });
}

export function listenOutgoingRequests(
  userId: string,
  onChange: (requests: ConnectionRequest[]) => void
): Unsubscribe {
  const database = requireDb();
  const q = query(collection(database, 'connectionRequests'), where('fromUserId', '==', userId));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => mapRequest(d.id, d.data())));
  });
}

export async function respondToConnectionRequest(
  requestId: string,
  status: 'accepted' | 'declined'
): Promise<void> {
  const database = requireDb();
  await updateDoc(doc(database, 'connectionRequests', requestId), {
    status,
    updatedAt: new Date().toISOString(),
  });
}
