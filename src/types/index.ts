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
  admin: boolean;
  stats: UserStats;
  profileCompletedAt?: string;
  activatedAt?: string;
  firstCardImageDownloadedAt?: string;
  firstCardViewedAt?: string;
  firstContactDownloadedAt?: string;
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

/** One-sided bookmark of another brother's public card (from Save to Contacts). */
export interface CollectedCard {
  id: string;
  subjectUserId: string;
  username: string;
  name: string;
  chapter: string;
  initiationYear: number;
  profilePicture?: string;
  occupation?: string;
  currentCity?: string;
  collectedAt: string;
  source: 'vcard_download';
}

/**
 * One member (or anonymous browser session) encountered another member's Kappa Card.
 * Distinct from analytics `stats.cardViews*` — only strong signals (e.g. QR) create these.
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
