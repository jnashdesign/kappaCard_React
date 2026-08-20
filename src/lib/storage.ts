import { getBlob, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { blobToSquareJpegBlob } from './contactPhoto';
import { auth, storage } from './firebase';

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const CONTACT_CACHE = 'public,max-age=3600';

async function uploadUserImage(
  file: File,
  basename: 'profile' | 'background'
): Promise<{ url: string; path: string }> {
  if (!storage || !auth?.currentUser) {
    throw new Error('You must be signed in to upload a photo.');
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('Please upload a JPG, PNG, or WebP image.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Photo must be 5MB or smaller.');
  }

  const uid = auth.currentUser.uid;
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `profile-pictures/${uid}/${basename}.${extension}`;
  const objectRef = ref(storage, path);

  await uploadBytes(objectRef, file, {
    contentType: file.type,
    cacheControl: 'public,max-age=3600',
  });

  const url = await getDownloadURL(objectRef);
  return { url, path };
}

async function uploadContactJpeg(blob: Blob): Promise<{ url: string; path: string } | null> {
  if (!storage || !auth?.currentUser) return null;
  const path = `profile-pictures/${auth.currentUser.uid}/contact.jpg`;
  const objectRef = ref(storage, path);
  await uploadBytes(objectRef, blob, {
    contentType: 'image/jpeg',
    cacheControl: CONTACT_CACHE,
  });
  const url = await getDownloadURL(objectRef);
  return { url, path };
}

/** Circle / avatar photo on the Kappa Card, plus a 320×320 JPEG for vCards. */
export async function uploadProfilePhoto(file: File): Promise<{
  url: string;
  path: string;
  contactUrl?: string;
  contactPath?: string;
}> {
  const contactJpegPromise = blobToSquareJpegBlob(file).catch(() => null);
  const original = await uploadUserImage(file, 'profile');
  const jpeg = await contactJpegPromise;
  if (!jpeg) return original;

  try {
    const contact = await uploadContactJpeg(jpeg);
    if (!contact) return original;
    return { ...original, contactUrl: contact.url, contactPath: contact.path };
  } catch {
    return original;
  }
}

/**
 * One-time backfill for members who uploaded a photo before contact JPEGs existed.
 * Returns null when nothing needs writing.
 */
export async function ensureContactPhotoUploaded(user: {
  profilePicture?: string;
  profilePicturePath?: string;
  contactPhoto?: string;
}): Promise<{ url: string; path: string } | null> {
  if (user.contactPhoto) return null;
  if (!user.profilePicture && !user.profilePicturePath) return null;
  if (!storage || !auth?.currentUser) return null;

  let source: Blob | null = null;
  if (user.profilePicture) {
    try {
      const response = await fetch(user.profilePicture, { mode: 'cors' });
      if (response.ok) source = await response.blob();
    } catch {
      /* try Storage path next */
    }
  }
  if (!source && user.profilePicturePath) {
    try {
      source = await profilePhotoBlob(user.profilePicturePath);
    } catch {
      return null;
    }
  }
  if (!source) return null;

  const jpeg = await blobToSquareJpegBlob(source);
  if (!jpeg) return null;
  return uploadContactJpeg(jpeg);
}

/** Full-bleed background behind the Kappa Card (not used in vCard). */
export async function uploadCardBackground(file: File): Promise<{ url: string; path: string }> {
  return uploadUserImage(file, 'background');
}

export async function profilePhotoToDataUrl(path: string): Promise<string> {
  const blob = await profilePhotoBlob(path);
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read profile photo.'));
    reader.readAsDataURL(blob);
  });
}

/** Public-read Storage blob — used for card PNG export and vCard photo embed. */
export async function profilePhotoBlob(path: string): Promise<Blob> {
  if (!storage) throw new Error('Storage is not configured.');
  return getBlob(ref(storage, path));
}
