/**
 * Stripe Checkout + webhook.
 * Kept in a separate module so Recap can deploy without STRIPE_* secrets.
 *
 * To enable payments: after setting STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET,
 * uncomment the require in index.js:
 *   Object.assign(exports, require('./stripePayments'));
 */
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const Stripe = require('stripe');
const {
  seedClaimedFromUsersIfNeeded,
  remainingOf,
} = require('./foundingPromo');

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

const BASIC_AMOUNT_CENTS = 999;
const BASIC_PRODUCT_NAME = 'Kappa Card Basic';

function getStripe(secretValue) {
  return new Stripe(secretValue);
}

function appOrigin(rawOrigin) {
  if (typeof rawOrigin === 'string' && /^https?:\/\//i.test(rawOrigin)) {
    return rawOrigin.replace(/\/$/, '');
  }
  return 'https://mykappacard.com';
}

/**
 * Authenticated callable: create a Stripe Checkout Session for Basic ($9.99).
 */
exports.createCheckoutSession = onCall(
  {
    secrets: [stripeSecretKey],
    region: 'us-central1',
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in to purchase Basic.');
    }

    const uid = request.auth.uid;
    const email = request.auth.token.email || undefined;
    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new HttpsError('failed-precondition', 'Complete your profile before purchasing.');
    }

    const user = userSnap.data() || {};
    if (user.admin || user.tier === 'basic' || user.tier === 'premium') {
      throw new HttpsError('already-exists', 'Your account is already unlocked.');
    }

    const promoData = await seedClaimedFromUsersIfNeeded(db);
    const promo = remainingOf(promoData);
    if (promo.enabled && promo.remaining > 0) {
      throw new HttpsError(
        'failed-precondition',
        `Inaugural offer still open — ${promo.remaining} free spot${
          promo.remaining === 1 ? '' : 's'
        } left. Claim free Basic instead of paying.`
      );
    }

    const successPath =
      typeof request.data?.successPath === 'string' && request.data.successPath.startsWith('/')
        ? request.data.successPath
        : '/upgrade/success';
    const cancelPath =
      typeof request.data?.cancelPath === 'string' && request.data.cancelPath.startsWith('/')
        ? request.data.cancelPath
        : '/pricing';

    const origin = appOrigin(request.data?.origin || request.rawRequest?.headers?.origin);
    const stripe = getStripe(stripeSecretKey.value());

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        // Classic Checkout: account may have Managed Payments on by default (requires tax codes).
        managed_payments: { enabled: false },
        customer_email: email,
        client_reference_id: uid,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: BASIC_AMOUNT_CENTS,
              product_data: {
                name: BASIC_PRODUCT_NAME,
                description:
                  'One-time unlock: branded Kappa Card + QR, live public page, and member invites.',
                // Electronically supplied services (digital access)
                tax_code: 'txcd_10000000',
              },
            },
          },
        ],
        metadata: {
          firebaseUid: uid,
          product: 'basic',
        },
        success_url: `${origin}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}${cancelPath}`,
      });
    } catch (err) {
      console.error('Stripe checkout.sessions.create failed', err);
      const detail =
        err && typeof err === 'object' && 'message' in err
          ? String(err.message)
          : 'Could not start Stripe Checkout.';
      throw new HttpsError('failed-precondition', detail);
    }

    await userRef.set(
      {
        stripeCheckoutSessionId: session.id,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return {
      url: session.url,
      sessionId: session.id,
    };
  }
);

/**
 * Stripe webhook: on checkout.session.completed, set users/{uid}.tier = basic.
 */
exports.stripeWebhook = onRequest(
  {
    secrets: [stripeSecretKey, stripeWebhookSecret],
    region: 'us-central1',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const stripe = getStripe(stripeSecretKey.value());
    const signature = req.headers['stripe-signature'];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        stripeWebhookSecret.value()
      );
    } catch (err) {
      console.error('Webhook signature verification failed', err);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const uid =
        session.metadata?.firebaseUid ||
        session.client_reference_id ||
        null;

      if (!uid) {
        console.error('Checkout session missing firebaseUid', session.id);
        res.status(400).send('Missing firebaseUid');
        return;
      }

      const db = getFirestore();
      const paymentRef = db.collection('payments').doc(session.id);
      const userRef = db.collection('users').doc(uid);

      await db.runTransaction(async (tx) => {
        const existing = await tx.get(paymentRef);
        if (existing.exists) {
          return;
        }

        tx.set(paymentRef, {
          sessionId: session.id,
          userId: uid,
          amountTotal: session.amount_total ?? BASIC_AMOUNT_CENTS,
          currency: session.currency ?? 'usd',
          customerEmail: session.customer_details?.email || session.customer_email || null,
          paymentStatus: session.payment_status || 'paid',
          product: 'basic',
          createdAt: FieldValue.serverTimestamp(),
        });

        tx.set(
          userRef,
          {
            tier: 'basic',
            stripeCheckoutSessionId: session.id,
            stripeCustomerId: session.customer || null,
            unlockedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      });
    }

    res.json({ received: true });
  }
);
