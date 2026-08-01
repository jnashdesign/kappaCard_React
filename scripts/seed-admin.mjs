/**
 * Seed the first admin account using Firebase Admin SDK.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *   SEED_ADMIN_EMAIL=you@example.com \
 *   SEED_ADMIN_PASSWORD='choose-a-strong-password' \
 *   SEED_ADMIN_NAME='Your Name' \
 *   SEED_ADMIN_USERNAME='yourname' \
 *   SEED_ADMIN_CHAPTER='Alpha' \
 *   SEED_ADMIN_YEAR=2000 \
 *   node scripts/seed-admin.mjs
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

  const email = required('SEED_ADMIN_EMAIL');
  const password = required('SEED_ADMIN_PASSWORD');
  const name = required('SEED_ADMIN_NAME');
  const username = required('SEED_ADMIN_USERNAME').toLowerCase();
  const chapter = process.env.SEED_ADMIN_CHAPTER || 'Alpha';
  const initiationYear = Number(process.env.SEED_ADMIN_YEAR || new Date().getFullYear());
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

  const profile = {
    email,
    name,
    username,
    chapter,
    chapterOfInitiation: chapter,
    initiationYear,
    inviteCode,
    tier: 'premium',
    admin: true,
    socialMedia: {},
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection('users').doc(user.uid).set(profile, { merge: true });
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

  console.log('Admin profile ready.');
  console.log(`  uid: ${user.uid}`);
  console.log(`  username: ${username}`);
  console.log(`  invite code: ${inviteCode}`);
  console.log(`  card url: /card/${username}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
