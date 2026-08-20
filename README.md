# Kappa Card (PWA)

React + Vite progressive web app for fraternity contact-card sharing.

Sibling of `kappacard` (legacy React Native / Expo app) at:

`/Users/jnash/codebase/kappaCard_React`

## Product summary

- Public live Card pages at `/card/{username}`
- Scan QR → open page → **Add to Contacts** (`.vcf`)
- **Brothers** list: QR meets and saved contacts in one place (`/brothers`)
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

## Architecture

- Tech approach (with links into diagrams): [`ARCHITECTURE.md`](ARCHITECTURE.md)
- Diagrams (Mermaid ER / flowcharts): [`ARCHITECTURE_DIAGRAMS.md`](ARCHITECTURE_DIAGRAMS.md)

Canonical TypeScript interfaces: [`src/types/index.ts`](src/types/index.ts). Rules: [`firestore.rules`](firestore.rules). Session notes: [`SESSION_DOCUMENTATION.md`](SESSION_DOCUMENTATION.md).

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

### Inaugural 100 (free → paid)

First **100** unlocked member accounts get Basic free as **Inaugural** members; account **101+** pays via Stripe.

- Counter: `config/foundingPromo` (`limit`, `claimed`, `enabled`) — public read, Admin SDK write
- Callables: `claimFoundingBasic`, `getFoundingPromoStatus`, `setInauguralExclusion`
- Signup auto-claims a spot when the new profile is still `free`
- `/pricing` shows remaining Inaugural spots; Checkout is blocked while free spots remain
- Public + My Card show an **Inaugural 100** badge (with slot # when available)
- Admin → Members: **Exclude from Inaugural 100** for test/staff accounts (clears badge, frees the slot, keeps tier)
- Admin complimentary invites (`grantsBasic`) still work and do **not** consume Inaugural spots

## Brothers recap email (Resend)

End-of-day digests when a member met brothers via QR that day.

1. Create a [Resend](https://resend.com) account and verify sending domain `recap.mykappacard.com` (DNS SPF/DKIM). Default From is `Kappa Card <noreply@recap.mykappacard.com>`.
2. Set the API key:

```bash
firebase functions:secrets:set RESEND_API_KEY --project kappacards-07212025
# paste re_...
```

3. Deploy functions (includes hourly `sendBrothersRecapEmails` + callable `sendBrothersRecapNow`):

```bash
firebase deploy --only functions --project kappacards-07212025
```

Only `RESEND_API_KEY` is required for Brothers recap. Stripe Checkout is in `functions/stripePayments.js` and loaded from `functions/index.js` once `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set.

Optional env overrides on the function: `KAPPACARD_APP_ORIGIN`, `KAPPACARD_RECAP_FROM`.

Members control the preference under **My Profile → Email reminders**. Admins can tap **Send test recap now** on that screen.

## Deploy

```bash
npm run build
firebase deploy --only hosting,functions,firestore:rules,storage --project kappacards-07212025
```

### Public profile privacy (required order)

Private email/phone live only on `users/{uid}` (owner/admin). Scanners read `publicProfiles/{uid}`.

1. `firebase deploy --only functions --project kappacards-07212025` (includes `syncPublicProfile` + `backfillPublicProfiles`)
2. Backfill existing members (admin, while signed in): call `backfillPublicProfiles` **or**  
   `GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json npm run backfill:public-profiles`
3. Deploy hosting with the client that uses `getPublicProfileByUsername`
4. Deploy rules: `firebase deploy --only firestore:rules,storage --project kappacards-07212025`

**Verify:** signed-out Firestore read of `users/{uid}` fails; `publicProfiles/{uid}` has no private fields; public card + vCard still work; marking phone Private removes it from the card and projection; vCard uses `contact.jpg` when present (Storage rules must allow public read of `contact.*` when the profile picture is public).

Live app: https://mykappacard.com

Also available at: https://kappacards-07212025.web.app / https://kappacards-07212025.firebaseapp.com

