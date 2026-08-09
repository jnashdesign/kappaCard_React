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

- Deploy Stripe secrets + Cloud Functions + webhook endpoint (test mode first) — code ready
- Deploy updated Firestore rules (public engagement bumps + payments + complimentary invites)
- Enable Google provider in Firebase console + authorized domains
- Polish Card visual design / additional templates
- Harden username alias redirect UX with HTTP-level redirects if moving to SSR/hosting later
- Replace solid-color PWA icon placeholders with branded artwork
- Optional: remove leftover `src/lib/connections.ts` / types when networking returns as a deliberate feature
- Optional: Stripe Customer Portal / receipts polish; premium tier products later
- Optional Phase 1 analytics: `analyticsEvents` + Cloud Function daily rollups when member count outgrows client aggregation


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

## Session: Complimentary Basic invites (2026-08-01)

- Invites support `grantsBasic` (admin-only). Regular invites stay paywalled (`tier: free` → Stripe). Complimentary invites set `tier: basic` on signup.
- Invites page: **Generate regular invite** for everyone with Basic; admins also get **Generate complimentary Basic**. Chapter share code can toggle complimentary ↔ paywalled.
- Admin invite-request approval: **Approve (paywalled)** vs **Approve + complimentary Basic**.
- Firestore rules: only admins may create/update `grantsBasic: true`.

## Session: Account deletion (2026-08-02)

- Profile page **Delete account** section: confirm by typing username.
- Deletes Auth user, `users` doc, username aliases, invites created by the member, and profile photos.
- Invitees keep their accounts; Firestore rules allow owners to delete their user doc and invites.
- Before wipe, writes `accountDeletions` log (admin-readable) for churn analytics: chart metric, KPI, recent list.

## Session: Admin analytics Phase 0 (2026-08-02)

- Free baseline: per-user `stats` counters + milestone timestamps (`profileCompletedAt`, `activatedAt`, first card/view/contact).
- Instrumented login, invite create, profile save, card image download, public card view (session-debounced), contact download.
- Admin → **Analytics** tab: new-per-period chart, activation funnel, recruiter/catalyst boards, who-is-active, chapter density, year/city/province breakdowns.
- Optional `province` on profile. Firestore allows public engagement bumps limited to stats/milestone keys.
- Phase 1 (events + Cloud Function daily rollups) deferred until this outgrows.

## Session: Collected brothers list (2026-08-03)

- Signed-in members who tap **Save to Contacts** on another brother’s `/card/:username` also upsert a bookmark under `users/{uid}/collectedCards/{subjectUid}`.
- Anonymous downloads still get the `.vcf` only; footnote prompts sign-in to keep him in Collected.
- New protected `/collected` page + nav link: list by `collectedAt` desc with link to live card and Remove.
- Client-side search filters the list by name, username, chapter, city, occupation, or year.
- Firestore rules: owner-only read/write on the subcollection. Account delete clears collected cards.
- Not Basic-gated; one-sided bookmark (not connection requests).

## Session: Card background upload (2026-08-02)

- Separate from circle photo: `cardBackground` + `cardBackgroundPath` on the user profile.
- Storage path `profile-pictures/{uid}/background.{ext}`; Profile has **Circle photo** and **Card background** uploaders with independent Public/Private toggles.
- My Card and public card hero use the background with a crimson scrim for readability; default gradient when unset.
- PNG export inlines the background via Storage `getBlob` (same CORS-safe path as the circle photo).
- vCard / Add to Contacts still uses only the circle photo.

## Session: Auth orphan + signup latency (2026-08-02)

### Email still “taken” after delete
- Root cause: Firestore/profile cleanup ran **before** `deleteUser()`. When Firebase threw `auth/requires-recent-login`, the Auth record (and email) stayed while the app profile was gone.
- Fix: **reauthenticate first** (password field for email/password; Google popup for Google), then wipe data, then delete Auth.
- **Existing orphans**: delete the email manually in Firebase Console → Authentication → Users. Signup cannot reclaim an Auth email that still exists.

### Slow ~10s signup on paywalled invite
- Expected destination: free tier → My Card paywall / Unlock Basic → pricing. Complimentary (`grantsBasic`) invites skip that.
- Latency came from sequential Firestore work in `createUserProfile`: username availability (2 reads), invite query, optional inviter fetch, then user doc → claimUsername (re-checked availability) → personal invite → re-fetched invite to mark used.
- Fix: parallel username reads; skip second availability check on claim; write user + username + personal invite in `Promise.all`; mark redeemed invite without a redundant getDoc.

## Session: Public card social icons (2026-08-08)

- Contact details on `/card/{username}` now include public social handles as icon-only links (LinkedIn, X, Instagram, Snapchat).
- Icons open the profile URL in a new tab; handles still respect per-field Public/Private via `toPublicProfile()`.
- Shared URL builders live in `src/lib/social.ts` (also used by vCard social URL lines).
- Details card still shows when only socials are public (no email/phone).

## Session: My Card toolbar icons (2026-08-08)

- Removed the verbose “Keep Your Card Ready / Manage Your Info” side panel and three text buttons.
- Owner actions are now a compact toolbar on the card’s top-right: download, edit (profile), preview (public card).
- Toolbar sits outside the PNG capture node so icons are not baked into the downloaded card image.

## Session: YouTube + TikTok handles (2026-08-08)

- Added optional `youtube` and `tiktok` to `socialMedia`, with Public/Private toggles on Profile (same pattern as other socials).
- Public card icons + vCard URL lines include them when Public (`youtube.com/@handle`, `tiktok.com/@handle`).

## Session: QR visit attribution (2026-08-09)

- New QR codes encode `/card/{username}?via=qr`; normal shares, nav, preview, and vCard URLs stay `/card/{username}` (no query).
- `PublicCardPage` derives `visitSource` (`qr` | `direct`) from the query and exposes it as `data-visit-source` for later QR-origin UX.
- Alias username redirects preserve the search string so `?via=qr` is not dropped; `/kard/:username` redirects preserve search too.
- Profile view analytics (Phase 0 counters): still increments `stats.cardViews`, plus `stats.cardViewsQr` or `stats.cardViewsDirect` by source. Session debounce key includes source.
- Old printed QR codes without `?via=qr` continue to work and count as `direct`.
- Helpers live in `src/lib/cardUrl.ts`.

## Session: QR auto Save-to-Contacts experiment (2026-08-09)

- On `?via=qr` visits only, after the profile loads, attempt the existing vCard download once (same path as **Save to Contacts**).
- Normal `/card/{username}` visits never auto-download; the button always remains for retry if auto is blocked/cancelled/fails.
- Guards: `sessionStorage` key `kappa:autoVcard:{userId}` (blocks refresh loops), in-memory ref (Strict Mode), `isLikelyBotOrPreviewAgent()` UA/webdriver heuristic.
- Temporary console logs prefixed `[KappaCard QR]`: visit detected, auto attempt initiated, failure/prevention when detectable.
- Does not bypass OS/browser confirmations — iOS may still show its download/Add Contact sheet.

### Manual test plan (QR auto vCard)

Use a **new** QR (regenerate My Card image) or open `/card/{username}?via=qr`. Watch DevTools / remote Web Inspector for `[KappaCard QR]` logs. Clear the tab’s sessionStorage (or use a fresh private tab) when re-testing auto-download.

**Common checks (all platforms)**  
1. Direct visit `/card/{username}` — profile loads; **no** auto download; button works.  
2. QR visit `?via=qr` — profile loads; auto attempt runs once; button still visible.  
3. Refresh the QR URL — must **not** auto-download again in the same tab session.  
4. If auto fails/blocked — tap **Save to Contacts**; should still work.  
5. Confirm OS dialogs are still shown (do not expect silent add-to-contacts).

**iPhone Safari**  
1. Scan regenerated card QR (or paste `?via=qr` URL).  
2. Expect: page loads; Safari download / preview / “Add to Contacts” style UI as usual for `.vcf`.  
3. Logs: QR visit detected → Automatic vCard attempt initiated.  
4. Refresh — no second auto attempt.  
5. Cancel OS prompt if shown, then use **Save to Contacts**.

**Android Chrome**  
1. Open `?via=qr` (scan or paste).  
2. Expect: download of `.vcf` or open-with Contacts prompt.  
3. Same refresh / button fallback checks as above.

**Desktop Safari**  
1. Open `?via=qr`.  
2. Expect: download of `.vcf` (Downloads list); open file to add contact.  
3. Note: programmatic download without a click may be limited — if blocked, log should report failure and button remains the path.

**Desktop Chrome**  
1. Open `?via=qr`.  
2. Expect: `.vcf` download in the download bar.  
3. Refresh loop + button fallback checks.  
4. Direct visit control: no auto download.

