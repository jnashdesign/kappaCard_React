const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { runBrothersRecapBatch, runBrothersRecapForUid } = require('./brothersRecap');

initializeApp();

const resendApiKey = defineSecret('RESEND_API_KEY');

/**
 * Hourly: send end-of-day Brothers recap emails for members in their local 8pm hour
 * who met at least one brother via QR today (and have not opted out).
 */
exports.sendBrothersRecapEmails = onSchedule(
  {
    schedule: 'every 1 hours',
    timeZone: 'Etc/UTC',
    region: 'us-central1',
    secrets: [resendApiKey],
  },
  async () => {
    const db = getFirestore();
    const summary = await runBrothersRecapBatch(db, resendApiKey.value(), { force: false });
    console.log('Brothers recap batch', summary);
  }
);

/**
 * Callable QA helper: send a recap for the signed-in user now.
 * Ignores the 8pm window but still requires today’s meets and enabled preference.
 */
exports.sendBrothersRecapNow = onCall(
  {
    secrets: [resendApiKey],
    region: 'us-central1',
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in to send a test recap.');
    }
    const db = getFirestore();
    const result = await runBrothersRecapForUid(db, resendApiKey.value(), request.auth.uid, {
      force: true,
    });
    if (result.status === 'missing') {
      throw new HttpsError('not-found', 'Profile not found.');
    }
    if (result.status === 'error') {
      throw new HttpsError(
        'internal',
        result.message || 'Email provider rejected the send. Check Resend logs.'
      );
    }
    return {
      status: result.status,
      to: result.to || null,
      resendId: result.resendId || null,
    };
  }
);

/* Inaugural 100 free Basic, then paid Checkout. */
Object.assign(exports, {
  claimFoundingBasic: require('./foundingPromo').claimFoundingBasic,
  getFoundingPromoStatus: require('./foundingPromo').getFoundingPromoStatus,
  setInauguralExclusion: require('./foundingPromo').setInauguralExclusion,
});

/* Stripe Checkout + webhook (requires STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET). */
Object.assign(exports, require('./stripePayments'));
