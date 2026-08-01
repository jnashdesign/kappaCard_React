/**
 * Seed a free (or basic) user invited by an existing admin.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *   SEED_INVITER_UID=<admin-uid> \
 *   SEED_USER_EMAIL=brother@example.com \
 *   SEED_USER_PASSWORD='temp-password' \
 *   SEED_USER_NAME='Brother Name' \
 *   SEED_USER_USERNAME='brothername' \
 *   SEED_USER_CHAPTER='Alpha' \
 *   SEED_USER_YEAR=2010 \
 *   SEED_USER_TIER=free \
 *   node scripts/seed-user.mjs
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

function createInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function initAdmin() {
  if (getApps().length) return;
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.');
  }
  const serviceAccount = JSON.parse(readFileSync(credPath, 'utf8'));
  initializeApp({
    credential: cert(serviceAccount),
  });
}

async function main() {
  initAdmin();
  const auth = getAuth();
  const db = getFirestore();

  const inviterUid = required('SEED_INVITER_UID');
  const inviterSnap = await db.collection('users').doc(inviterUid).get();
  if (!inviterSnap.exists) throw new Error('Inviter user profile not found.');
  const inviter = inviterSnap.data();

  const email = required('SEED_USER_EMAIL');
  const password = required('SEED_USER_PASSWORD');
  const name = required('SEED_USER_NAME');
  const username = required('SEED_USER_USERNAME').toLowerCase();
  const chapter = process.env.SEED_USER_CHAPTER || 'Alpha';
  const initiationYear = Number(process.env.SEED_USER_YEAR || new Date().getFullYear());
  const tier = process.env.SEED_USER_TIER || 'free';
  const inviteCode = createInviteCode();

  let user;
  try {
    user = await auth.getUserByEmail(email);
    console.log('Auth user already exists:', user.uid);
  } catch {
    user = await auth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,
    });
    console.log('Created auth user:', user.uid);
  }

  await db.collection('users').doc(user.uid).set(
    {
      email,
      name,
      username,
      chapter,
      chapterOfInitiation: chapter,
      initiationYear,
      invitedBy: inviterUid,
      invitedByUsername: inviter.username,
      invitedByName: inviter.name,
      invitedByChapter: inviter.chapter || inviter.chapterOfInitiation,
      invitedByInitiationYear: inviter.initiationYear,
      inviteCode,
      tier,
      admin: false,
      socialMedia: {},
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await db.collection('usernames').doc(username).set({
    username,
    userId: user.uid,
    current: true,
    createdAt: new Date().toISOString(),
  });

  await db.collection('invites').doc(`${user.uid}_${inviteCode}`).set({
    code: inviteCode,
    inviterId: user.uid,
    inviterName: name,
    inviterUsername: username,
    active: true,
    createdAt: new Date().toISOString(),
  });

  console.log('Seeded user ready.');
  console.log(`  uid: ${user.uid}`);
  console.log(`  username: ${username}`);
  console.log(`  tier: ${tier}`);
  console.log(`  invited by: @${inviter.username}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
