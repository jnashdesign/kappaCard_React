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
- Firebase Auth / Firestore
- `qrcode` + `html-to-image` for Card generation
- `vite-plugin-pwa` for installability

## Deploy

```bash
npm run build
firebase deploy --only hosting --project kappacards-07212025
```

Live app: https://kappacards-07212025.web.app

Also available at: https://kappacards-07212025.firebaseapp.com

