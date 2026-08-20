/** Square JPEG used in vCards — generated once at upload, not on every scan. */
export const CONTACT_PHOTO_SIZE = 320;
const QUALITY = 0.72;
const QUALITY_SMALL = 0.55;
/** ~135KB JPEG ≈ 180KB data-URL, matching the previous vCard size cap. */
const MAX_JPEG_BYTES = 135_000;

function drawSquareCanvas(bitmap: ImageBitmap): HTMLCanvasElement | null {
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = Math.max(0, Math.floor((bitmap.width - side) / 2));
  const sy = Math.max(0, Math.floor((bitmap.height - side) / 2));
  const canvas = document.createElement('canvas');
  canvas.width = CONTACT_PHOTO_SIZE;
  canvas.height = CONTACT_PHOTO_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, CONTACT_PHOTO_SIZE, CONTACT_PHOTO_SIZE);
  return canvas;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });
}

/** Center-crop + resize to 320×320 JPEG for Contacts. */
export async function blobToSquareJpegBlob(source: Blob): Promise<Blob | null> {
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = drawSquareCanvas(bitmap);
    if (!canvas) return null;
    let blob = await canvasToJpegBlob(canvas, QUALITY);
    if (blob && blob.size > MAX_JPEG_BYTES) {
      blob = await canvasToJpegBlob(canvas, QUALITY_SMALL);
    }
    return blob;
  } finally {
    bitmap.close();
  }
}

export async function blobToBase64(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const marker = 'base64,';
      const index = dataUrl.indexOf(marker);
      resolve(index === -1 ? null : dataUrl.slice(index + marker.length));
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/** Fallback when no pre-generated contact JPEG exists. */
export async function blobToSquareJpegBase64(source: Blob): Promise<string | null> {
  const jpeg = await blobToSquareJpegBlob(source);
  if (!jpeg) return null;
  return blobToBase64(jpeg);
}
