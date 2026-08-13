export type { FieldPrivacy } from '../lib/privacy';
import type { FieldPrivacy } from '../lib/privacy';

export type MembershipTier = 'free' | 'basic' | 'premium';

export interface SocialMedia {
  linkedin?: string;
  x?: string;
  instagram?: string;
  snapchat?: string;
  youtube?: string;
  tiktok?: string;
}

/** Lifetime product-action counters (Phase 0 analytics). */
export interface UserStats {
  logins: number;
  invitesCreated: number;
  profileUpdates: number;
  cardImageDownloads: number;
  cardViews: number;
  /** Subset of cardViews that arrived with ?via=qr */
  cardViewsQr: number;
  /** Subset of cardViews without QR attribution */
  cardViewsDirect: number;
  contactDownloads: number;
}

/** Email notification preferences (server stamps lastBrothersRecapDate). */
export interface UserEmailPrefs {
  /** Default true when omitted */
  brothersRecapEnabled?: boolean;
  /** Local YYYY-MM-DD of last successful Brothers recap send */
  lastBrothersRecapDate?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  username: string;
  phone?: string;
  chapter: string;
  chapterOfInitiation?: string;
  currentChapter?: string;
  initiationYear: number;
  occupation?: string;
  currentEmployer?: string;
  currentCity?: string;
  /** Optional region/state for density reporting */
  province?: string;
  profilePicture?: string;
  /** Storage object path for reliable card export via getBlob */
  profilePicturePath?: string;
  /** Custom Kappa Card / public hero background (separate from circle photo) */
  cardBackground?: string;
  cardBackgroundPath?: string;
  socialMedia?: SocialMedia;
  /** Per-field visibility for optional contact details */
  fieldPrivacy?: FieldPrivacy;
  invitedBy?: string;
  invitedByUsername?: string;
  invitedByName?: string;
  invitedByChapter?: string;
  invitedByInitiationYear?: number;
  inviteCode: string;
  tier: MembershipTier;
  /** True when Basic was unlocked via the Inaugural 100 free offer. */
  inauguralMember?: boolean;
  /** 1-based slot within the Inaugural 100. */
  inauguralSlot?: number;
  /** @deprecated Prefer inauguralMember */
  foundingMember?: boolean;
  /** @deprecated Prefer inauguralSlot */
  foundingSlot?: number;
  /**
   * Admin flag: test / staff accounts that must not consume an Inaugural slot
   * and must not show the Inaugural badge.
   */
  excludeFromInaugural?: boolean;
  admin: boolean;
  stats: UserStats;
  profileCompletedAt?: string;
  activatedAt?: string;
  firstCardImageDownloadedAt?: string;
  firstCardViewedAt?: string;
  firstContactDownloadedAt?: string;
  /** IANA timezone for scheduled emails (e.g. America/Chicago) */
  timezone?: string;
  emailPrefs?: UserEmailPrefs;
  createdAt: string;
  updatedAt: string;
}

export interface UsernameAlias {
  username: string;
  userId: string;
  current: boolean;
  createdAt: string;
}

export type ConnectionStatus = 'pending' | 'accepted' | 'declined';

export interface ConnectionRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromName: string;
  fromUsername: string;
  toName: string;
  toUsername: string;
  status: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InviteRecord {
  id: string;
  code: string;
  inviterId: string;
  inviterName: string;
  inviterUsername: string;
  inviterChapter?: string;
  inviterInitiationYear?: number;
  usedBy?: string;
  usedAt?: string;
  createdAt: string;
  active: boolean;
  /** Admin chapter share codes stay redeemable until disabled */
  multiUse?: boolean;
  useCount?: number;
  lastUsedAt?: string;
  /**
   * When true, redeeming this invite sets the new member to `tier: basic` (complimentary).
   * Only admins may create these. Regular invites omit this / false → paywalled `free`.
   */
  grantsBasic?: boolean;
}

export type InviteRequestStatus = 'pending' | 'approved' | 'declined';

/** Survives account wipe — admin analytics for churn. */
export interface AccountDeletion {
  id: string;
  userId: string;
  username: string;
  email: string;
  name: string;
  chapter: string;
  province?: string;
  initiationYear?: number;
  tier: MembershipTier;
  wasActivated: boolean;
  deletedAt: string;
}

/** Person-centric brother row (`users/{uid}/collectedCards/{subjectUid}`). */
export interface BrotherRecord {
  id: string;
  subjectUserId: string;
  username: string;
  name: string;
  chapter: string;
  initiationYear: number;
  profilePicture?: string;
  occupation?: string;
  currentCity?: string;
  /** True when this brother was added/updated via a QR scan encounter. */
  metViaQr: boolean;
  /** True when Save to Contacts was used for this brother. */
  savedContact: boolean;
  lastMetAt?: string;
  savedContactAt?: string;
  firstActivityAt: string;
  lastActivityAt: string;
  event?: string;
  location?: string;
  privateNote?: string;
  /** @deprecated Prefer savedContactAt / lastActivityAt */
  collectedAt?: string;
  /** @deprecated Prefer metViaQr / savedContact flags */
  source?: 'vcard_download' | string;
}

/** @deprecated Use BrotherRecord — kept for transitional imports */
export type CollectedCard = BrotherRecord;

/**
 * One member (or anonymous browser session) encountered another member's Kappa Card.
 * Used for anonymous QR → claim-on-login; authenticated QR upserts Brothers directly.
 * Distinct from analytics `stats.cardViews*`.
 */
export type EncounterSource = 'qr' | 'direct' | (string & {});

export interface Encounter {
  id: string;
  /** Card / profile owner */
  ownerId: string;
  /** Authenticated scanner; null/absent when anonymous */
  viewerId?: string | null;
  /** Opaque local UUID for claim-on-login; never treat as public identity */
  anonymousSessionId?: string | null;
  timestamp: string;
  source: EncounterSource;
  event?: string;
  location?: string;
  /** Scanner-only; not readable by the card owner via security rules */
  privateNote?: string;
  createdAt: string;
  updatedAt: string;
  /** Set when an anonymous encounter is claimed by a signed-in user */
  claimedAt?: string;
}

/** Public request for an invite — admin verifies membership manually */
export interface InviteRequest {
  id: string;
  name: string;
  chapter: string;
  initiationYear: number;
  email: string;
  status: InviteRequestStatus;
  createdAt: string;
  updatedAt?: string;
  reviewedAt?: string;
  inviteCode?: string;
}

export const RESERVED_USERNAMES = [
  'admin',
  'analytics',
  'login',
  'signup',
  'kard',
  'card',
  'api',
  'settings',
  'profile',
  'invite',
  'invites',
  'collected',
  'met',
  'request-invite',
  'requests',
  'upgrade',
  'pricing',
  'auth',
  'google',
  'help',
  'support',
  'about',
  'privacy',
  'terms',
] as const;
