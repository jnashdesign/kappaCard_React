# Kappa Card — Architecture diagrams

Visual companion to [`ARCHITECTURE.md`](ARCHITECTURE.md). Each section below is an anchor target linked from the tech doc.

| Tech topic | This file |
|------------|-----------|
| System stack | [#system-stack](#system-stack) |
| Firestore overview | [#firestore-overview](#firestore-overview) |
| Collection paths | [#collection-paths](#collection-paths) |
| User profile (nested) | [#user-profile-nested](#user-profile-nested) |
| Invites & signup flow | [#invites-and-signup-flow](#invites-and-signup-flow) |
| Invite entity shapes | [#invite-entity-shapes](#invite-entity-shapes) |
| Public card & QR visit flow | [#public-card-and-qr-visit-flow](#public-card-and-qr-visit-flow) |
| Brothers upsert flow | [#brothers-upsert-flow](#brothers-upsert-flow) |
| Encounters vs analytics | [#encounters-vs-profile-analytics](#encounters-vs-profile-analytics) |
| Encounter entity | [#encounter-entity](#encounter-entity) |
| Payments & account deletion | [#payments-and-account-deletion](#payments-and-account-deletion) |
| Deferred connection requests | [#deferred-connection-requests](#deferred-connection-requests) |

Canonical TypeScript: [`src/types/index.ts`](src/types/index.ts). Rules: [`firestore.rules`](firestore.rules).

---

## System stack

```mermaid
flowchart TB
  subgraph client [Browser PWA]
    React["React 19 + Vite SPA"]
    Router["React Router"]
    QR["qrcode + html-to-image"]
  end

  subgraph firebase [Firebase kappacards-07212025]
    Auth["Authentication"]
    FS["Firestorestore"]
    Storage["Storage"]
    Hosting["Hosting"]
    Fns["Cloud Functions"]
  end

  subgraph external [External]
    Stripe["Stripe Checkout"]
  end

  React --> Router
  React --> Auth
  React --> FS
  React --> Storage
  QR --> React
  Hosting --> React
  Fns --> Stripe
  Fns --> FS
  React --> Fns
```

---

## Firestore overview

```mermaid
erDiagram
  users ||--o{ usernames : "aliases resolve to"
  users ||--o{ invites : "creates as inviter"
  users ||--o{ collectedCards : "bookmarks"
  users ||--o{ encounters : "owner of scanned card"
  users ||--o{ encounters : "authenticated viewer"
  users ||--o{ accountDeletions : "churn log on delete"
  users ||--o{ payments : "Stripe unlock"
  inviteRequests ||--o| invites : "admin approve may create"

  users {
    string id PK
    string email
    string name
    string username
    string tier
    boolean admin
    map stats
    map fieldPrivacy
    map socialMedia
  }

  usernames {
    string username PK
    string userId FK
    boolean current
  }

  invites {
    string id PK
    string code
    string inviterId FK
    boolean active
    boolean multiUse
    boolean grantsBasic
  }

  inviteRequests {
    string id PK
    string email
    string status
  }

  encounters {
    string id PK
    string ownerId FK
    string viewerId FK
    string anonymousSessionId
    string source
    string timestamp
  }

  collectedCards {
    string id PK
    string subjectUserId FK
    string collectedAt
  }

  accountDeletions {
    string id PK
    string userId
    string deletedAt
  }

  payments {
    string id PK
    string userId FK
  }
```

---

## Collection paths

| Path | Purpose |
|------|---------|
| `users/{uid}` | Member profile, tier, stats, privacy, inviter denorm |
| `users/{uid}/collectedCards/{subjectUid}` | Brothers list row (QR meet and/or saved contact + private notes) |
| `usernames/{slug}` | Public slug → uid (aliases for renames) |
| `invites/{id}` | One-time and multi-use invite codes |
| `inviteRequests/{id}` | Public “request an invite” inbox for admins |
| `encounters/{id}` | Anonymous QR claim pipeline (not the Brothers UI store) |
| `accountDeletions/{id}` | Churn analytics after account wipe |
| `payments/{sessionId}` | Stripe Checkout records (Admin SDK only) |

**Storage (not Firestore):** `profile-pictures/{uid}/profile.*`, `profile-pictures/{uid}/background.*`.

---

## User profile nested

```mermaid
erDiagram
  UserProfile ||--|| UserStats : embeds
  UserProfile ||--o| SocialMedia : embeds
  UserProfile ||--o| FieldPrivacy : embeds
  UserProfile ||--o{ BrotherRecord : "collectedCards subcollection"

  UserProfile {
    string id
    string email
    string name
    string username
    string phone
    string chapter
    number initiationYear
    string occupation
    string currentEmployer
    string currentCity
    string province
    string profilePicture
    string profilePicturePath
    string cardBackground
    string cardBackgroundPath
    string invitedBy
    string inviteCode
    string tier
    boolean admin
    string createdAt
    string updatedAt
  }

  UserStats {
    number logins
    number invitesCreated
    number profileUpdates
    number cardImageDownloads
    number cardViews
    number cardViewsQr
    number cardViewsDirect
    number contactDownloads
  }

  SocialMedia {
    string linkedin
    string x
    string instagram
    string snapchat
    string youtube
    string tiktok
  }

  FieldPrivacy {
    string email
    string phone
    string occupation
    string profilePicture
    string cardBackground
    string linkedin
    string x
    string instagram
    string snapchat
    string youtube
    string tiktok
  }

  BrotherRecord {
    string subjectUserId
    string username
    string name
    string chapter
    number initiationYear
    string profilePicture
    string occupation
    string currentCity
    boolean metViaQr
    boolean savedContact
    string lastMetAt
    string savedContactAt
    string firstActivityAt
    string lastActivityAt
    string event
    string location
    string privateNote
  }
```

**Always public (not in `fieldPrivacy`):** name, username, chapter, initiation year, inviter accountability fields.

**Optional fields:** default `public` until flipped to `private`; `toPublicProfile()` strips private values for the public card and vCard.

---

## Invites and signup flow

```mermaid
flowchart LR
  subgraph publicFlow [Public]
    ReqInvite["/request-invite"]
    Signup["/signup + invite code"]
  end

  subgraph firestore [Firestore]
    IR["inviteRequests"]
    INV["invites"]
    U["users"]
    UN["usernames"]
  end

  ReqInvite -->|create pending| IR
  Admin[Admin approve] -->|create one-time invite| INV
  Signup -->|redeem code| INV
  Signup -->|create| U
  Signup -->|claim slug| UN
  INV -->|inviterId| U
  U -->|invitedBy denorm| U
```

---

## Invite entity shapes

```mermaid
erDiagram
  InviteRecord {
    string id
    string code
    string inviterId
    string inviterName
    string inviterUsername
    string inviterChapter
    number inviterInitiationYear
    string usedBy
    string usedAt
    boolean active
    boolean multiUse
    number useCount
    string lastUsedAt
    boolean grantsBasic
    string createdAt
  }

  InviteRequest {
    string id
    string name
    string chapter
    number initiationYear
    string email
    string status
    string createdAt
    string inviteCode
  }

  UsernameAlias {
    string username
    string userId
    boolean current
    string createdAt
  }
```

---

## Public card and QR visit flow

```mermaid
flowchart TD
  subgraph share [Share artifact]
    MyCard["My Card PNG + QR"]
    QR["QR encodes /card/user?via=qr"]
    MyCard --> QR
  end

  subgraph visit [Visitor]
    Scan["Scan or open URL"]
    Page["PublicCardPage"]
    VCard["Save to Contacts .vcf"]
    Scan --> Page
    Page --> VCard
  end

  QR --> Scan
  Direct["Shared /card/user link"] --> Page
```

Normal shares and vCard profile URLs omit `?via=qr`. Only generated QR codes include the attribution query param.

---

## Brothers upsert flow

```mermaid
flowchart TD
  qrAuth["QR visit signed in"] --> upsert["Upsert users/uid/collectedCards/subjectUid"]
  save["Save to Contacts"] --> upsert
  qrAnon["QR visit anonymous"] --> enc["encounters doc"]
  enc --> claim["Login claim"]
  claim --> upsert
  upsert --> list["Brothers list /brothers"]
  list --> detail["Detail /brothers/subjectUid"]
```

One row per brother. Badges: Met via QR and/or Saved contact. Notes live on the brother row.

---

## Encounters vs profile analytics

Encounters are **not** the same as profile views. Direct visits bump `users.stats.cardViews*`. QR visits (`?via=qr`) bump analytics **and** upsert Brothers (signed-in) or write an anonymous `encounters` doc for claim.

```mermaid
flowchart TD
  visit["Open /card/username"]
  visit --> source{"via=qr?"}
  source -->|no| analyticsDirect["stats.cardViews + cardViewsDirect"]
  source -->|yes| analyticsQr["stats.cardViews + cardViewsQr"]
  source -->|yes| auth{"Signed in?"}
  auth -->|yes| brother["Brothers upsert metViaQr"]
  auth -->|no| anon["encounters anonymousSessionId"]
  anon --> claim["On login: claim → Brothers upsert"]
  claim --> brother
```

---

## Encounter entity

```mermaid
erDiagram
  Encounter {
    string id
    string ownerId
    string viewerId
    string anonymousSessionId
    string timestamp
    string source
    string event
    string location
    string privateNote
    string createdAt
    string updatedAt
    string claimedAt
  }
```

**Privacy:** Private notes for day-to-day use live on the **Brothers** row (`collectedCards`). Top-level `encounters` remain for anonymous QR → claim; owners still cannot client-read encounter docs in v1.

---

## Payments and account deletion

```mermaid
erDiagram
  Payment {
    string id
    string userId
    string status
  }

  AccountDeletion {
    string id
    string userId
    string username
    string email
    string name
    string chapter
    string province
    number initiationYear
    string tier
    boolean wasActivated
    string deletedAt
  }
```

- `payments`: written only by Cloud Functions / Admin SDK; clients have no read/write.
- `accountDeletions`: member creates on wipe; admins read for churn analytics.

```mermaid
flowchart LR
  FreeUser["Free signed-in user"] --> Checkout["createCheckoutSession"]
  Checkout --> Stripe["Stripe Hosted Checkout"]
  Stripe --> Webhook["stripeWebhook"]
  Webhook --> Tier["users.tier = basic"]
  Webhook --> PayDoc["payments/sessionId"]
```

---

## Deferred connection requests

```mermaid
erDiagram
  ConnectionRequest {
    string id
    string fromUserId
    string toUserId
    string status
  }
```

Types remain in code for a possible later return. Requests UI and Firestore rules for connection requests are not in the current product path.
