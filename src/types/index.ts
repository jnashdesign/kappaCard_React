export type { FieldPrivacy } from '../lib/privacy';
import type { FieldPrivacy } from '../lib/privacy';

export type MembershipTier = 'free' | 'basic' | 'premium';

export interface SocialMedia {
  linkedin?: string;
  x?: string;
  instagram?: string;
  snapchat?: string;
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
  profilePicture?: string;
  /** Storage object path for reliable card export via getBlob */
  profilePicturePath?: string;
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
  'login',
  'signup',
  'kard',
  'card',
  'api',
  'settings',
  'profile',
  'invite',
  'invites',
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
