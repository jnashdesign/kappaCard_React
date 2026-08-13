/**
 * Inaugural 100: first N member accounts unlock Basic free; after that, Stripe.
 * Counter: config/foundingPromo (kept doc id for continuity; Admin SDK writes only).
 */
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const FOUNDING_LIMIT = 100;

function promoRef(db) {
  return db.collection('config').doc('foundingPromo');
}

function remainingOf(data) {
  const limit = typeof data?.limit === 'number' ? data.limit : FOUNDING_LIMIT;
  const claimed = typeof data?.claimed === 'number' ? data.claimed : 0;
  const enabled = data?.enabled !== false;
  const remaining = enabled ? Math.max(0, limit - claimed) : 0;
  return { limit, claimed, enabled, remaining };
}

function isInauguralUserData(user) {
  if (user?.excludeFromInaugural) return false;
  return Boolean(user?.inauguralMember || user?.foundingMember);
}

async function ensureFoundingPromo(db) {
  const ref = promoRef(db);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      return { ref, data: snap.data() };
    }
    const data = {
      limit: FOUNDING_LIMIT,
      claimed: 0,
      enabled: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(ref, data);
    return { ref, data: { limit: FOUNDING_LIMIT, claimed: 0, enabled: true } };
  });
}

/**
 * One-time seed of claimed count from current Inaugural-eligible unlocked members.
 */
async function seedClaimedFromUsersIfNeeded(db) {
  await ensureFoundingPromo(db);
  const ref = promoRef(db);
  const current = (await ref.get()).data() || {};
  if (current.seededFromUsers) return current;

  const usersSnap = await db.collection('users').get();
  let unlocked = 0;
  usersSnap.forEach((docSnap) => {
    const u = docSnap.data() || {};
    if (u.admin || u.excludeFromInaugural) return;
    if (u.tier === 'basic' || u.tier === 'premium') unlocked += 1;
  });

  const limit = typeof current.limit === 'number' ? current.limit : FOUNDING_LIMIT;
  const claimed = Math.min(limit, Math.max(Number(current.claimed) || 0, unlocked));

  await ref.set(
    {
      limit,
      claimed,
      enabled: current.enabled !== false,
      seededFromUsers: true,
      seededAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return (await ref.get()).data();
}

async function requireAdmin(db, uid) {
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists || !snap.data()?.admin) {
    throw new HttpsError('permission-denied', 'Admin only.');
  }
}

/**
 * Callable: claim one Inaugural Basic slot for the signed-in free member.
 */
exports.claimFoundingBasic = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in to claim an Inaugural spot.');
  }

  const uid = request.auth.uid;
  const db = getFirestore();
  await seedClaimedFromUsersIfNeeded(db);

  const userRef = db.collection('users').doc(uid);
  const ref = promoRef(db);

  return db.runTransaction(async (tx) => {
    const [userSnap, promoSnap] = await Promise.all([tx.get(userRef), tx.get(ref)]);

    if (!userSnap.exists) {
      throw new HttpsError('failed-precondition', 'Complete your profile first.');
    }

    const user = userSnap.data() || {};
    if (user.excludeFromInaugural) {
      return { status: 'excluded', ...remainingOf(promoSnap.data()) };
    }

    if (user.admin || user.tier === 'basic' || user.tier === 'premium') {
      return { status: 'already', ...remainingOf(promoSnap.data()) };
    }

    if (!promoSnap.exists) {
      throw new HttpsError('failed-precondition', 'Inaugural offer is not configured.');
    }

    const promo = remainingOf(promoSnap.data());
    if (!promo.enabled || promo.remaining <= 0) {
      return { status: 'exhausted', ...promo };
    }

    const now = new Date().toISOString();
    const nextClaimed = promo.claimed + 1;
    tx.set(
      userRef,
      {
        tier: 'basic',
        inauguralMember: true,
        inauguralSlot: nextClaimed,
        // Back-compat aliases
        foundingMember: true,
        foundingSlot: nextClaimed,
        unlockedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
    tx.set(
      ref,
      {
        claimed: nextClaimed,
        updatedAt: now,
      },
      { merge: true }
    );

    return {
      status: 'granted',
      limit: promo.limit,
      claimed: nextClaimed,
      remaining: Math.max(0, promo.limit - nextClaimed),
      enabled: true,
      foundingSlot: nextClaimed,
      inauguralSlot: nextClaimed,
    };
  });
});

/** Callable status helper (Pricing can also read Firestore directly). */
exports.getFoundingPromoStatus = onCall({ region: 'us-central1' }, async () => {
  const db = getFirestore();
  await seedClaimedFromUsersIfNeeded(db);
  const snap = await promoRef(db).get();
  return remainingOf(snap.data());
});

/**
 * Admin: mark a member excluded from the Inaugural 100 (test accounts).
 * Removes Inaugural badge and frees their slot if they had one. Keeps tier as-is.
 */
exports.setInauguralExclusion = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }

  const targetId = typeof request.data?.userId === 'string' ? request.data.userId.trim() : '';
  const exclude = Boolean(request.data?.exclude);
  if (!targetId) {
    throw new HttpsError('invalid-argument', 'userId is required.');
  }

  const db = getFirestore();
  await requireAdmin(db, request.auth.uid);
  await seedClaimedFromUsersIfNeeded(db);

  const userRef = db.collection('users').doc(targetId);
  const ref = promoRef(db);

  return db.runTransaction(async (tx) => {
    const [userSnap, promoSnap] = await Promise.all([tx.get(userRef), tx.get(ref)]);
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'Member not found.');
    }

    const user = userSnap.data() || {};
    const wasInaugural = isInauguralUserData(user);
    const now = new Date().toISOString();
    const promo = remainingOf(promoSnap.data());

    if (exclude) {
      tx.update(userRef, {
        excludeFromInaugural: true,
        inauguralMember: false,
        foundingMember: false,
        inauguralSlot: FieldValue.delete(),
        foundingSlot: FieldValue.delete(),
        updatedAt: now,
      });

      let claimed = promo.claimed;
      if (wasInaugural && claimed > 0) {
        claimed -= 1;
        tx.set(ref, { claimed, updatedAt: now }, { merge: true });
      }

      return {
        status: 'excluded',
        userId: targetId,
        ...remainingOf({ ...promo, claimed }),
      };
    }

    tx.set(
      userRef,
      {
        excludeFromInaugural: false,
        updatedAt: now,
      },
      { merge: true }
    );

    return {
      status: 'included',
      userId: targetId,
      ...promo,
    };
  });
});

exports.ensureFoundingPromo = ensureFoundingPromo;
exports.seedClaimedFromUsersIfNeeded = seedClaimedFromUsersIfNeeded;
exports.remainingOf = remainingOf;
exports.FOUNDING_LIMIT = FOUNDING_LIMIT;
