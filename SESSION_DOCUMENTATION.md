# Kappa Card — Session Documentation

## Session date
2026-07-29

## Goal
Replace the broader React Native networking app with a simplified React PWA focused on QR contact sharing, invite accountability, and a saveable Kappa Card image.

## Location
New app created as a sibling directory (not inside `kappacard`):

- Legacy RN app: `/Users/jnash/codebase/kappacard`
- New PWA: `/Users/jnash/codebase/kappaCard_React`

## Firebase project
Uses **KappaCards** Firebase project `kappacards-07212025` (not `nupenetwork-app`), so hosting/live URL stay on the KappaCards property.

Updated: 2026-07-29 — switched `.env.local` to KappaCards config.

### 2026-07-29 — Profile photo + inviter on card
- Profile photo upload to Firebase Storage (`profile-pictures/{uid}/…`)
- Photo appears on My Card image and public `/card/{username}` page
- Inviter shown on card artwork and in vCard `NOTE` for accountability
- New signups store `invitedByName` from the invite record

### 2026-07-29 — Field-level Public/Private toggles
- Always public: name, username, chapter, initiation year (plus inviter accountability)
- Optional fields (email, phone, occupation, employer, city, photo, socials) store `fieldPrivacy` on the user doc
- Defaults remain **public** until the member flips a field to Private
- `toPublicProfile()` strips private fields for `/card/{username}` and Add to Contacts (vCard)
- Owner My Card view still uses full profile data for generation
- Note: Firestore `users` remain broadly readable; privacy is enforced in the public UI projection (a Cloud Function public projection could harden this later)

### 2026-07-29 — Profile edit UI polish
- Crimson identity banner with photo (click to upload), live name/chapter preview
- Quick actions: view public card + copy username link
- Form grouped into Photo / Identity / Contact / Work & place / Social
- Sticky save bar with status messaging
- Soft section entrance motion (respects reduced-motion)

### 2026-07-29 — Public card page UI polish
- Crimson hero card matching My Card brand (photo/initials, name, chapter/year, role/city)
- Inviter accountability strip on the hero
- Contact/social as tappable rows (mailto/tel/external links)
- Primary Add to Contacts CTA; empty-state when all optional fields are private
- Owner sees Edit profile shortcut

### 2026-07-29 — Remove Home/dashboard
- Post-login landing is `/my-card` (signup, login, complete-profile, brand link)
- Nav: My Card first; Home/dashboard page removed
- `/dashboard` redirects to `/my-card` for old bookmarks

### 2026-07-29 — Landing page redesign
- Flat crimson hero (no box shadows) with Kappa Card brand, pitch, CTAs, and card preview
- How it works (4 steps) + Built for brothers (live URL, privacy toggles, invite accountability)
- Closing CTA strip; respects reduced-motion

### 2026-07-29 — Invite disable + status
- Invites list shows Active / Used / Disabled
- Disable sets `active: false` (soft-delete); unused codes can no longer be redeemed
- On redeem: invite keeps the record, sets `usedBy` to the new member’s uid, `usedAt`, and `active: false` (not null)

### 2026-07-29 — Admin chapter share code
- Admins get one reusable `multiUse` invite (`{uid}_SHARE`) for chapter-wide sharing
- Remains redeemable while Active; Enable/Disable toggle; tracks `useCount` / `lastUsedAt`
- One-time invites unchanged for individual invites

### 2026-07-29 — Hide connection requests
- Removed Requests nav/page and public-card “Send connection request” (no friends list yet)
- `/requests` redirects to `/my-card`; connection helper kept for a possible later return
- Future idea: networking / re-add contacts after phone loss could be a **premium** feature; QR + live `/card` + Add to Contacts covers the core path for now

### 2026-07-30 — Embed profile photo in vCard
- Save to Contacts embeds public profile photo as JPEG base64 in the `.vcf`
- Applied CORS on Storage bucket `kappacards-07212025.firebasestorage.app` so browser can fetch photo bytes
- Photo resolve times out after 6s so “Preparing contact…” cannot hang; downloads without photo if embed fails
- Note: iPhone **My Card** / Name & Photo Sharing can keep an older personal photo even when a new `.vcf` is imported

### 2026-07-30 — Firestore cleanup after Auth purge
- Deleted 1,546 non-admin `users` docs; kept only `justin@jnashdev.com`
- Emptied `connectionRequests`, `connections`, `discoverableUsers`, `discoverySessions`
- Removed orphan invites not owned by the admin; `usernames` still has `jnashdev`
- Removed `connectionRequests` match from `firestore.rules` (networking not in product); deployed rules
- Confirmed `invites` collection empty and cleared admin `inviteCode` for a clean start
- Deleted legacy `invitations` collection docs (39) from the older app schema
- Restored admin self-invite: `invitedBy` → self with name/chapter/year denormalized; standing used invite in `invites` + one `invitations` record

### 2026-07-30 — Invite request flow
- Public `/request-invite` form: name, chapter, initiation year, email (for sending the invite)
- Landing primary CTA: “Request an invite”; signup links to the form
- Admin reviews pending requests; Approve creates a one-time invite and copies the signup link
- Firestore `inviteRequests` rules: public create (pending only), admin read/update/delete


## Product decisions

1. **PWA over React Native** for this version — accept weaker iOS push/background location (features we are not shipping).
2. **Option B QR model**: static QR encodes `/card/{username}`; profile data is fetched live after scan.
3. **URL path**: `/card/{username}` (with `/kard/{username}` redirect for older links).
4. **Usernames** are memorable public slugs; immutable Firebase uid remains the internal key. Username renames keep old aliases that resolve to the same user and rewrite to the canonical username.
5. **Invite-gated signup** (except seeded admin). Google sign-in allowed, but first-time Google users still must complete invite + profile fields.
6. **Paywall timing**: invite → create account → unlock Basic (one-time purchase). Stripe checkout stubbed as “coming soon”; admins can assign tiers while seeding.
7. **Tiers**: `free`, `basic`, `premium` (premium reserved; no features yet).
8. **No member directory** — privacy / non-discoverability preference.
9. **No location or push notifications**.
10. **Connection requests deferred** — no friends list for now; may return later as premium.
11. **Admin model**: seeded admin can grant/revoke admin on other accounts; cannot revoke self.
12. **One fraternity-branded Card template** for v1; more templates later.
13. Required signup fields match legacy app: name, email, password, chapter, initiation year, invite code (+ username for public URL).

## Architecture notes

- Vite + React + TypeScript SPA/PWA
- Firebase Auth + Firestore collections: `users`, `usernames`, `invites`
- Public Card page builds a vCard download for Add to Contacts
- My Card page renders branded card + QR and exports PNG via `html-to-image`
- Seed scripts use Firebase Admin SDK (`scripts/seed-admin.mjs`, `scripts/seed-user.mjs`)

## Still to do / follow-ups

- Wire Stripe Checkout for Basic one-time purchase + webhook to set `tier: basic`
- Enable Google provider in Firebase console + authorized domains
- Polish Card visual design / additional templates
- Harden username alias redirect UX with HTTP-level redirects if moving to SSR/hosting later
- Replace solid-color PWA icon placeholders with branded artwork
- Optional: remove leftover `src/lib/connections.ts` / types when networking returns as a deliberate feature

## Why these choices
Keep the viral action (scan → contacts) fast and durable (static QR), while membership integrity stays invite-based and admin-auditable. Building as a sibling repo/app avoids mixing the new PWA with the Expo mobile codebase.

## Session: vCard ORG / NOTES layout (2026-07-31)

- **ORG** is chapter + space + initiation year only (no pipe). Occupation is no longer `TITLE` (that was showing as “occupation · org” under the photo on iOS).
- **NOTES** lead with Occupation / Employer, blank line, then `Invited by: Name ◆ Chapter Year`.
- **formatInviter** omits `(@username)`; used by vCard notes and card UI.

## Session: Landing hero phone image (2026-07-31)

- Replaced the CSS-mocked hero card with `public/card_phone.png` (`/card_phone.png`).

## Session: GitHub repo initialization (2026-08-01)

- Audited `.gitignore` before first push: `.env`, `.env.*` (with `!.env.example`), `*.local`, `serviceAccount*.json`, `node_modules`, `dist`, and `.firebase/` are ignored so local Firebase credentials and deploy cache stay private.
- Created GitHub remote and initial commit on `main`.
