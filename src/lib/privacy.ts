import type { SocialMedia, UserProfile } from '../types';

export type PrivacyField =
  | 'email'
  | 'phone'
  | 'occupation'
  | 'currentEmployer'
  | 'currentCity'
  | 'profilePicture'
  | 'cardBackground'
  | 'linkedin'
  | 'x'
  | 'instagram'
  | 'snapchat';

export type FieldVisibility = 'public' | 'private';

export type FieldPrivacy = Partial<Record<PrivacyField, FieldVisibility>>;

export const PRIVACY_FIELDS: PrivacyField[] = [
  'email',
  'phone',
  'occupation',
  'currentEmployer',
  'currentCity',
  'profilePicture',
  'cardBackground',
  'linkedin',
  'x',
  'instagram',
  'snapchat',
];

/** Defaults keep current product behavior: optional fields are public until changed. */
export const DEFAULT_FIELD_PRIVACY: Record<PrivacyField, FieldVisibility> = {
  email: 'public',
  phone: 'public',
  occupation: 'public',
  currentEmployer: 'public',
  currentCity: 'public',
  profilePicture: 'public',
  cardBackground: 'public',
  linkedin: 'public',
  x: 'public',
  instagram: 'public',
  snapchat: 'public',
};

export function normalizeFieldPrivacy(privacy?: FieldPrivacy | null): Record<PrivacyField, FieldVisibility> {
  return {
    ...DEFAULT_FIELD_PRIVACY,
    ...(privacy ?? {}),
  };
}

export function isFieldPublic(
  privacy: FieldPrivacy | undefined | null,
  field: PrivacyField
): boolean {
  return normalizeFieldPrivacy(privacy)[field] === 'public';
}

/** Strip private fields for public card page + vCard downloads. */
export function toPublicProfile(user: UserProfile): UserProfile {
  const privacy = normalizeFieldPrivacy(user.fieldPrivacy);
  const socialMedia: SocialMedia = {};

  if (privacy.linkedin === 'public' && user.socialMedia?.linkedin) {
    socialMedia.linkedin = user.socialMedia.linkedin;
  }
  if (privacy.x === 'public' && user.socialMedia?.x) {
    socialMedia.x = user.socialMedia.x;
  }
  if (privacy.instagram === 'public' && user.socialMedia?.instagram) {
    socialMedia.instagram = user.socialMedia.instagram;
  }
  if (privacy.snapchat === 'public' && user.socialMedia?.snapchat) {
    socialMedia.snapchat = user.socialMedia.snapchat;
  }

  return {
    ...user,
    email: privacy.email === 'public' ? user.email : '',
    phone: privacy.phone === 'public' ? user.phone : undefined,
    occupation: privacy.occupation === 'public' ? user.occupation : undefined,
    currentEmployer: privacy.currentEmployer === 'public' ? user.currentEmployer : undefined,
    currentCity: privacy.currentCity === 'public' ? user.currentCity : undefined,
    profilePicture: privacy.profilePicture === 'public' ? user.profilePicture : undefined,
    profilePicturePath: privacy.profilePicture === 'public' ? user.profilePicturePath : undefined,
    cardBackground: privacy.cardBackground === 'public' ? user.cardBackground : undefined,
    cardBackgroundPath:
      privacy.cardBackground === 'public' ? user.cardBackgroundPath : undefined,
    socialMedia,
  };
}
