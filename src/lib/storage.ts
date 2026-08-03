import { getBlob, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, storage } from './firebase';

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

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

/** Circle / avatar photo on the Kappa Card and contacts. */
export async function uploadProfilePhoto(file: File): Promise<{ url: string; path: string }> {
  return uploadUserImage(file, 'profile');
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
