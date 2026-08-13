# Kappa Card — Architecture & technical approach

This document describes how the Kappa Card PWA is built and why. Visual models for each area live in [`ARCHITECTURE_DIAGRAMS.md`](ARCHITECTURE_DIAGRAMS.md); every major section below links to the matching diagram anchor.

Session-by-session product notes remain in [`SESSION_DOCUMENTATION.md`](SESSION_DOCUMENTATION.md).

---

## 1. Product approach

Kappa Card is a **Progressive Web App** for fraternity contact sharing:

- A member builds a live public profile at `/card/{username}`.
- They download a branded **Kappa Card** image that embeds a **static QR** pointing at that URL (with `?via=qr` for scan attribution).
- Anyone who scans or opens the link can view the public card and **Save to Contacts** (`.vcf`) without installing an app.
- Signup is **invite-gated** for accountability. **Basic** unlocks card image generation and inviting others.

There is **no member directory**, background location, or push notifications in this version.

---

## 2. System stack

**Diagram:** [System stack](ARCHITECTURE_DIAGRAMS.md#system-stack)

| Layer | Choice |
|-------|--------|
| UI | React 19 + TypeScript + Vite SPA |
| Routing | React Router |
| Auth / DB / files / host | Firebase Auth, Firestore, Storage, Hosting |
| Server logic | Cloud Functions (Stripe checkout + webhook) |
| Payments | Stripe Checkout (one-time Basic unlock) |
| Card assets | `qrcode` + `html-to-image` |
| Installability | `vite-plugin-pwa` |

Firebase project: **`kappacards-07212025`** (live: [mykappacard.com](https://mykappacard.com)).

---

## 3. Application structure

| Area | Location |
|------|----------|
| Routes | [`src/App.tsx`](src/App.tsx) |
| Auth state | [`src/contexts/AuthContext.tsx`](src/contexts/AuthContext.tsx) |
| Domain libs | [`src/lib/`](src/lib/) (`users`, `vcard`, `brothers`, `encounters`, `privacy`, …) |
| Pages | [`src/pages/`](src/pages/) |
| Types | [`src/types/index.ts`](src/types/index.ts) |
| Rules | [`firestore.rules`](firestore.rules), [`storage.rules`](storage.rules) |
| Functions | [`functions/`](functions/) |

**Primary authenticated surfaces:** My Card, Profile, Brothers (`/brothers`), Invites, Admin.  
**Primary public surfaces:** Landing, Pricing, Request invite, Signup/Login, `/card/:username`.

Legacy `/kard/:username` redirects to `/card/:username` and preserves query params (including `?via=qr`).  
Legacy `/collected` and `/met` redirect to `/brothers`.

---

## 4. Authentication, tiers, and access

- Email/password and Google sign-in.
- First-time accounts require a valid **invite code** (except seeded admin bootstrap).
- Tiers: `free` | `basic` | `premium` (`premium` reserved).
- **Basic** unlocks Kappa Card PNG generation, inviting, and related card features (`canUseCardFeatures`).
- Admins can grant/revoke admin and set tiers; complimentary Basic invites use `grantsBasic` on invite docs.

Client profile documents are readable publicly for the live card page; **optional field privacy** is enforced by projecting through `toPublicProfile()` in the UI and vCard path (not by hiding the whole user doc).

---

## 5. Data layer (Firestorestore)

**Diagrams:** [Firestorestore overview](ARCHITECTURE_DIAGRAMS.md#firestore-overview) · [Collection paths](ARCHITECTURE_DIAGRAMS.md#collection-paths)

Firestorestore is the system of record. Top-level collections mirror product domains (`users`, `invites`, `encounters`, …). Subcollections are used where ownership is clear (`users/{uid}/collectedCards` — the Brothers list).

Security rules favor:

- Public **reads** where the live card needs them.
- Strict **creates/updates** (invite requests, anonymous encounters, engagement counter bumps).
- Owner-only private subcollections (Brothers / `collectedCards`).
- Admin-only or Admin-SDK-only sensitive collections (`payments`, churn logs read path).

Indexes: [`firestore.indexes.json`](firestore.indexes.json) (notably `encounters`: `viewerId` + `timestamp` for legacy merge / claim backfill).

---

## 6. User profile, privacy, and media

**Diagram:** [User profile nested](ARCHITECTURE_DIAGRAMS.md#user-profile-nested)

A `users/{uid}` document holds identity, chapter, optional contact/work fields, nested `socialMedia`, `fieldPrivacy`, and Phase-0 `stats`.

- **Circle photo** and **card background** are separate Storage objects; paths are stored on the profile for CORS-safe export via `getBlob`.
- **Always public:** name, username, chapter, initiation year, inviter accountability.
- **Optional fields** default to public; members can mark them private. Public card and vCard use `toPublicProfile()`.

---

## 7. Invites and onboarding

**Diagrams:** [Invites and signup flow](ARCHITECTURE_DIAGRAMS.md#invites-and-signup-flow) · [Invite entity shapes](ARCHITECTURE_DIAGRAMS.md#invite-entity-shapes)

1. Prospect may **request an invite** → `inviteRequests` (admin reviews).
2. Brother (or admin) creates an **invite** code → `invites`.
3. Prospect **signs up** with the code → `users` + `usernames` claim; invite marked used (or multi-use share code increments).
4. Inviter identity is denormalized onto the new user for card/vCard accountability.

Usernames are public slugs; Firebase Auth uid remains the immutable key. Renames keep alias docs under `usernames/`.

---

## 8. Public card, QR, and vCard

**Diagram:** [Public card and QR visit flow](ARCHITECTURE_DIAGRAMS.md#public-card-and-qr-visit-flow)

| Concern | Approach |
|---------|----------|
| Live profile | `/card/{username}` loads Firestore user → public projection |
| QR payload | Absolute URL with `?via=qr` ([`src/lib/cardUrl.ts`](src/lib/cardUrl.ts)) |
| Normal share / vCard URL | Same path **without** `via` (no false QR attribution) |
| Add to Contacts | Client builds vCard 3.0 with embedded JPEG photo when possible ([`src/lib/vcard.ts`](src/lib/vcard.ts)) |
| QR auto-download experiment | On QR visits only, one automatic vCard attempt; button always remains |

Profile **views** increment `users.stats.cardViews` (and `cardViewsQr` / `cardViewsDirect`). That is analytics, not a Brothers upsert.

---

## 9. Brothers list

**Diagrams:** [Brothers upsert flow](ARCHITECTURE_DIAGRAMS.md#brothers-upsert-flow) · [Encounters vs analytics](ARCHITECTURE_DIAGRAMS.md#encounters-vs-profile-analytics)

**Brothers** is one person-centric list (`/brothers`, detail `/brothers/:subjectUserId`). Storage path remains `users/{viewer}/collectedCards/{subject}` ([`src/lib/brothers.ts`](src/lib/brothers.ts)).

| Action | Effect |
|--------|--------|
| QR visit while signed in | Upsert brother; `metViaQr`; bump `lastMetAt` / `lastActivityAt` |
| Save to Contacts while signed in | Upsert same row; `savedContact`; bump `savedContactAt` / `lastActivityAt` |
| QR while anonymous | Write short-lived `encounters` doc; on login claim → upsert Brothers |
| Notes | `event`, `location`, `privateNote` on the brother row (owner-only) |

List shows badges (**Met via QR** / **Saved contact**), sorted by `lastActivityAt`. Opening Brothers also merges any legacy viewer `encounters` into brother rows.

---

## 10. Encounters (anonymous claim only)

**Diagram:** [Encounter entity](ARCHITECTURE_DIAGRAMS.md#encounter-entity)

Top-level `encounters` are **not** the primary Brothers UI store. Authenticated QR upserts Brothers directly. Anonymous QR still creates an encounter for claim-on-login; claim upserts Brothers then attaches `viewerId`.

Failures must not break the public card or vCard UX.

---

## 11. Payments

**Diagram:** [Payments and account deletion](ARCHITECTURE_DIAGRAMS.md#payments-and-account-deletion)

Free members unlock Basic via Stripe Checkout:

1. Callable `createCheckoutSession`
2. Hosted Checkout
3. Webhook sets `tier = basic` and writes `payments/{sessionId}`

Clients cannot read/write `payments`. Admins can still grant Basic manually.

---

## 12. Analytics

Phase 0 (shipped): counters and milestones on `users.stats` / timestamp fields; Admin Analytics aggregates client-side from user + invite lists.

Phase 1 (deferred): append-only `analyticsEvents` + Cloud Function rollups if volume outgrows client aggregation.

Account deletion writes an `accountDeletions` row for churn reporting before wiping the member’s data.

**Brothers recap email:** Resend + scheduled Cloud Function `sendBrothersRecapEmails` (hourly). Around **8:00 PM local** (`users.timezone`, default `America/Chicago`) when the member had QR meets that day and has not opted out (`emailPrefs.brothersRecapEnabled`). Deep links to `/brothers/{subjectUserId}`. Preference on Profile. Secret `RESEND_API_KEY`. QA callable `sendBrothersRecapNow`.

---

## 13. Security model (summary)

| Surface | Policy sketch |
|---------|----------------|
| `users` | Public read; owner update (no self-escalation of admin/tier); limited public engagement bumps |
| `collectedCards` | Owner-only (Brothers list + private notes) |
| `invites` | Public read; create/update constrained by owner / redeemer / admin |
| `inviteRequests` | Public create (pending); admin manage |
| `encounters` | Anon create for QR claim; read/update for viewer (or admin); no owner client read in v1 |
| `payments` | No client access |
| Storage profile media | Authenticated upload to own prefix; public read for card display |

Details: [`firestore.rules`](firestore.rules), [`storage.rules`](storage.rules).

---

## 14. Deployment

```bash
npm run build
firebase deploy --only hosting,firestore,functions --project kappacards-07212025
```

Hosting serves `dist/`. Prefer deploying **firestore** (rules + indexes) when Encounter list indexes change. Stripe and Resend secrets must be set before related functions succeed.

---

## 15. Related documents

| Doc | Role |
|-----|------|
| [`ARCHITECTURE_DIAGRAMS.md`](ARCHITECTURE_DIAGRAMS.md) | All architecture diagrams (linked throughout this file) |
| [`SESSION_DOCUMENTATION.md`](SESSION_DOCUMENTATION.md) | Chronological decisions and feature session notes |
| [`README.md`](README.md) | Quick start, Stripe setup, deploy commands |

---

## 16. Deferred / out of scope (current product)

**Diagram:** [Deferred connection requests](ARCHITECTURE_DIAGRAMS.md#deferred-connection-requests)

- Connection-request / friends-list networking UI
- Converting normal (non-QR) profile views into Encounters
- Owner-facing Encounter inbox (would need a projection that excludes private notes)
- Native iOS/Android apps for this product line
