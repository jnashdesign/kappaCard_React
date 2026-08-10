# Kappa Card (PWA)

React + Vite progressive web app for fraternity contact-card sharing.

Sibling of `kappacard` (legacy React Native / Expo app) at:

`/Users/jnash/codebase/kappaCard_React`

## Product summary

- Public live Card pages at `/card/{username}`
- Scan QR → open page → **Add to Contacts** (`.vcf`)
- Invite-gated signup for accountability
- Tiers: `free` | `basic` | `premium`
- Basic unlocks Card image generation, invites, and connection requests
- Admins can grant/revoke admin and set tiers
- Admins can issue **complimentary Basic** invites (or tag the chapter share code); regular invites stay paywalled for $9.99 unlock
- Admin **Analytics** tab (free baseline): new registrations per period, funnel, recruiter/catalyst boards, chapter density
- No member directory, location, or push notifications

## Quick start

```bash
cp .env.example .env.local
# fill VITE_FIREBASE_* values (KappaCards: kappacards-07212025)

npm install
npm run dev
```

Deploy Firestore rules from `firestore.rules` to your Firebase project.

### Seed admin

```bash
export GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json
export SEED_ADMIN_EMAIL=you@example.com
export SEED_ADMIN_PASSWORD='strong-password'
export SEED_ADMIN_NAME='Your Name'
export SEED_ADMIN_USERNAME='yourname'
export SEED_ADMIN_CHAPTER='Alpha'
export SEED_ADMIN_YEAR=2000
npm run seed:admin
```

### Seed invited free user

```bash
export GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json
export SEED_INVITER_UID=<admin-uid-from-seed>
export SEED_USER_EMAIL=brother@example.com
export SEED_USER_PASSWORD='temp-password'
export SEED_USER_NAME='Brother Name'
export SEED_USER_USERNAME='brothername'
export SEED_USER_TIER=free
npm run seed:user
```

## Stack

- React 19 + TypeScript + Vite
- React Router
- Firebase Auth / Firestore / Cloud Functions
- Stripe Checkout (one-time Basic unlock at $9.99)
- `qrcode` + `html-to-image` for Card generation
- `vite-plugin-pwa` for installability

## Data models

Firestorestore entity relationships, nested profile maps, invite/signup flow, Encounter vs analytics, and payments/deletion shapes are documented with diagrams in [`SESSION_DOCUMENTATION.md`](SESSION_DOCUMENTATION.md#data-models).

Canonical TypeScript interfaces: [`src/types/index.ts`](src/types/index.ts). Rules: [`firestore.rules`](firestore.rules).

## Pricing & Stripe

Public pricing page: `/pricing` ($9.99 one-time Basic).

Checkout flow:

1. Signed-in free user clicks **Unlock Basic**
2. Callable Cloud Function `createCheckoutSession` creates a Stripe Checkout Session
3. User pays on Stripe Hosted Checkout
4. Webhook `stripeWebhook` sets `users/{uid}.tier = basic` and records `payments/{sessionId}`
5. App returns to `/upgrade/success` and refreshes the profile

### Enable payments (one-time setup)

1. Create a Stripe account and copy the **Secret key** (test mode first).
2. From the project root:

```bash
cd functions && npm install && cd ..
firebase functions:secrets:set STRIPE_SECRET_KEY --project kappacards-07212025
# paste sk_test_... or sk_live_...
```

3. Deploy functions:

```bash
firebase deploy --only functions --project kappacards-07212025
```

4. In Stripe Dashboard → Developers → Webhooks → Add endpoint:
   - URL: `https://us-central1-kappacards-07212025.cloudfunctions.net/stripeWebhook`
   - Event: `checkout.session.completed`
   - Copy the signing secret (`whsec_...`)

```bash
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project kappacards-07212025
firebase deploy --only functions:stripeWebhook --project kappacards-07212025
```

5. Redeploy Firestore rules (adds locked-down `payments` collection):

```bash
firebase deploy --only firestore:rules --project kappacards-07212025
```

Optional frontend publishable key (not required for redirect Checkout):

```bash
# .env.local
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Until functions + secrets are live, checkout shows a friendly error and admins can still grant Basic manually.

## Deploy

```bash
npm run build
firebase deploy --only hosting,functions,firestore:rules --project kappacards-07212025
```

Live app: https://mykappacard.com

Also available at: https://kappacards-07212025.web.app / https://kappacards-07212025.firebaseapp.com

