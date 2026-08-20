/**
 * Public profile projections for live /card pages.
 * Full users/{uid} docs stay owner/admin-only; scanners read publicProfiles/{uid}.
 */
const { getFirestore } = require('firebase-admin/firestore');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const DEFAULT_FIELD_PRIVACY = {
  email: 'public',
  phone: 'public',
  occupation: 'public',
  currentEmployer: 'public',
  currentCity: 'public',
  profilePicture: 'public',
  cardBackground: 'public',
  linkedin: 'public',
  x: 'public',
  instagram: 'public',
  snapchat: 'public',
  youtube: 'public',
  tiktok: 'public',
  websites: 'public',
};

/** Fields that affect the public projection (ignore stats / milestones / prefs). */
const PROJECTION_SOURCE_KEYS = [
  'email',
  'name',
  'username',
  'phone',
  'chapter',
  'chapterOfInitiation',
  'currentChapter',
  'initiationYear',
  'occupation',
  'currentEmployer',
  'currentCity',
  'profilePicture',
  'profilePicturePath',
  'contactPhoto',
  'contactPhotoPath',
  'cardBackground',
  'cardBackgroundPath',
  'socialMedia',
  'websites',
  'fieldPrivacy',
  'invitedBy',
  'invitedByUsername',
  'invitedByName',
  'invitedByChapter',
  'invitedByInitiationYear',
  'inauguralMember',
  'inauguralSlot',
  'foundingMember',
  'foundingSlot',
  'excludeFromInaugural',
];

function normalizeFieldPrivacy(privacy) {
  return { ...DEFAULT_FIELD_PRIVACY, ...(privacy || {}) };
}

function isPublic(privacy, field) {
  return normalizeFieldPrivacy(privacy)[field] === 'public';
}

function sanitizeWebsites(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 80) : '';
    const urlInput = typeof item.url === 'string' ? item.url.trim() : '';
    if (!urlInput || urlInput.length > 500) continue;
    if (/^(javascript|data|vbscript|file|blob):/i.test(urlInput)) continue;
    const href = /^[a-z][a-z0-9+.-]*:/i.test(urlInput) ? urlInput : `https://${urlInput}`;
    try {
      const parsed = new URL(href);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
      if (!parsed.hostname.includes('.')) continue;
      const host = parsed.hostname.replace(/^www\./i, '');
      out.push({
        id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `web_${out.length}`,
        title: title || host,
        url: parsed.toString(),
      });
    } catch {
      continue;
    }
    if (out.length >= 12) break;
  }
  return out;
}

function stripUndefined(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item));
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const result = {};
    for (const [key, nested] of Object.entries(value)) {
      if (nested === undefined) continue;
      result[key] = stripUndefined(nested);
    }
    return result;
  }
  return value;
}

/**
 * Build a public-safe projection from a full users/{uid} document.
 * @param {string} userId
 * @param {FirebaseFirestore.DocumentData} data
 */
function buildPublicProfile(userId, data) {
  const privacy = data.fieldPrivacy;
  const socialIn = data.socialMedia || {};
  const socialMedia = {};

  if (isPublic(privacy, 'linkedin') && socialIn.linkedin) socialMedia.linkedin = socialIn.linkedin;
  if (isPublic(privacy, 'x') && socialIn.x) socialMedia.x = socialIn.x;
  if (isPublic(privacy, 'instagram') && socialIn.instagram) {
    socialMedia.instagram = socialIn.instagram;
  }
  if (isPublic(privacy, 'snapchat') && socialIn.snapchat) socialMedia.snapchat = socialIn.snapchat;
  if (isPublic(privacy, 'youtube') && socialIn.youtube) socialMedia.youtube = socialIn.youtube;
  if (isPublic(privacy, 'tiktok') && socialIn.tiktok) socialMedia.tiktok = socialIn.tiktok;

  const chapter = data.chapter || data.chapterOfInitiation || '';
  const inauguralMember = Boolean(
    !data.excludeFromInaugural && (data.inauguralMember || data.foundingMember)
  );
  const inauguralSlot =
    typeof data.inauguralSlot === 'number'
      ? data.inauguralSlot
      : typeof data.foundingSlot === 'number'
        ? data.foundingSlot
        : undefined;

  const projection = {
    id: userId,
    name: data.name || '',
    username: data.username || '',
    chapter,
    chapterOfInitiation: data.chapterOfInitiation || data.chapter || '',
    initiationYear: data.initiationYear ?? new Date().getFullYear(),
    invitedBy: data.invitedBy || null,
    invitedByUsername: data.invitedByUsername || null,
    invitedByName: data.invitedByName || null,
    invitedByChapter: data.invitedByChapter || null,
    invitedByInitiationYear:
      typeof data.invitedByInitiationYear === 'number' ? data.invitedByInitiationYear : null,
    inauguralMember,
    inauguralSlot: inauguralMember ? inauguralSlot ?? null : null,
    foundingMember: inauguralMember,
    foundingSlot: inauguralMember ? inauguralSlot ?? null : null,
    updatedAt: data.updatedAt || new Date().toISOString(),
    projectedAt: new Date().toISOString(),
  };

  if (isPublic(privacy, 'email') && data.email) projection.email = data.email;
  if (isPublic(privacy, 'phone') && data.phone) projection.phone = data.phone;
  if (isPublic(privacy, 'occupation') && data.occupation) projection.occupation = data.occupation;
  if (isPublic(privacy, 'currentEmployer') && data.currentEmployer) {
    projection.currentEmployer = data.currentEmployer;
  }
  if (isPublic(privacy, 'currentCity') && data.currentCity) {
    projection.currentCity = data.currentCity;
  }
  if (isPublic(privacy, 'profilePicture') && data.profilePicture) {
    projection.profilePicture = data.profilePicture;
  }
  if (isPublic(privacy, 'profilePicture') && data.profilePicturePath) {
    projection.profilePicturePath = data.profilePicturePath;
  }
  if (isPublic(privacy, 'profilePicture') && data.contactPhoto) {
    projection.contactPhoto = data.contactPhoto;
  }
  if (isPublic(privacy, 'profilePicture') && data.contactPhotoPath) {
    projection.contactPhotoPath = data.contactPhotoPath;
  }
  if (isPublic(privacy, 'cardBackground') && data.cardBackground) {
    projection.cardBackground = data.cardBackground;
  }
  if (isPublic(privacy, 'cardBackground') && data.cardBackgroundPath) {
    projection.cardBackgroundPath = data.cardBackgroundPath;
  }
  if (Object.keys(socialMedia).length) projection.socialMedia = socialMedia;
  if (isPublic(privacy, 'websites')) {
    const websites = sanitizeWebsites(data.websites);
    if (websites.length) projection.websites = websites;
  }

  return stripUndefined(projection);
}

function projectionInputsChanged(before, after) {
  if (!before) return true;
  for (const key of PROJECTION_SOURCE_KEYS) {
    const a = JSON.stringify(before[key] ?? null);
    const b = JSON.stringify(after[key] ?? null);
    if (a !== b) return true;
  }
  return false;
}

async function writePublicProfile(db, userId, data) {
  const projection = buildPublicProfile(userId, data);
  await db.collection('publicProfiles').doc(userId).set(projection);
  return projection;
}

async function deletePublicProfile(db, userId) {
  await db.collection('publicProfiles').doc(userId).delete().catch(() => undefined);
}

/**
 * Keep publicProfiles/{uid} in sync with users/{uid}.
 */
const syncPublicProfile = onDocumentWritten(
  {
    document: 'users/{userId}',
    region: 'us-central1',
  },
  async (event) => {
    const userId = event.params.userId;
    const db = getFirestore();
    const before = event.data.before.exists ? event.data.before.data() : null;
    const afterSnap = event.data.after;

    if (!afterSnap.exists) {
      await deletePublicProfile(db, userId);
      return null;
    }

    const after = afterSnap.data() || {};
    if (!projectionInputsChanged(before, after)) {
      return null;
    }

    await writePublicProfile(db, userId, after);
    return null;
  }
);

async function assertAdmin(db, uid) {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists || !snap.data()?.admin) {
    throw new HttpsError('permission-denied', 'Admin only.');
  }
}

/**
 * One-time / ops: rewrite all publicProfiles from current users docs.
 */
const backfillPublicProfiles = onCall({ region: 'us-central1' }, async (request) => {
  const db = getFirestore();
  await assertAdmin(db, request.auth?.uid);

  const usersSnap = await db.collection('users').get();
  let written = 0;
  let deletedOrphans = 0;

  const batchSize = 400;
  let batch = db.batch();
  let ops = 0;

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

  // Optional cleanup: publicProfiles without a users doc
  const publicSnap = await db.collection('publicProfiles').get();
  const userIds = new Set(usersSnap.docs.map((d) => d.id));
  for (const docSnap of publicSnap.docs) {
    if (userIds.has(docSnap.id)) continue;
    batch.delete(docSnap.ref);
    deletedOrphans += 1;
    ops += 1;
    if (ops >= batchSize) await flush();
  }
  await flush();

  return { written, deletedOrphans, userCount: usersSnap.size };
});

module.exports = {
  buildPublicProfile,
  writePublicProfile,
  deletePublicProfile,
  syncPublicProfile,
  backfillPublicProfiles,
};
