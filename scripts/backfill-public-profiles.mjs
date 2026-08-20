/**
 * One-time backfill: write publicProfiles/{uid} for every users/{uid} doc.
 *
 * Prefer the admin callable `backfillPublicProfiles` after deploying functions.
 * Use this script when you want a local Admin SDK run instead:
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *   node scripts/backfill-public-profiles.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const require = createRequire(import.meta.url);
const { buildPublicProfile } = require('../functions/publicProfiles.js');

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
  const db = getFirestore();
  const usersSnap = await db.collection('users').get();

  let written = 0;
  let batch = db.batch();
  let ops = 0;
  const batchSize = 400;

  async function flush() {
    if (ops === 0) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  }

  for (const docSnap of usersSnap.docs) {
    const projection = buildPublicProfile(docSnap.id, docSnap.data() || {});
    batch.set(db.collection('publicProfiles').doc(docSnap.id), projection);
    written += 1;
    ops += 1;
    if (ops >= batchSize) await flush();
  }
  await flush();

  console.log(`Wrote ${written} publicProfiles from ${usersSnap.size} users.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
