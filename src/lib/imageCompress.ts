/**
 * Compress an image file to a square JPEG under a target size (default 250KB).
 * Center-crops to a square so the avatar always looks right in circular containers,
 * then iteratively reduces dimensions / quality until the byte budget is met.
 */
export async function compressAvatar(
  file: File,
  opts: { maxBytes?: number; maxSize?: number; minSize?: number } = {}
): Promise<File> {
  const maxBytes = opts.maxBytes ?? 250 * 1024;
  let size = opts.maxSize ?? 512;
  const minSize = opts.minSize ?? 192;

  const bitmap = await loadBitmap(file);
  // Center-crop to square
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  let quality = 0.9;
  let blob: Blob | null = null;

  for (let i = 0; i < 8; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) break;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
    blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/jpeg', quality)
    );
    if (!blob) break;
    if (blob.size <= maxBytes) break;
    // Shrink quality first, then dimensions
    if (quality > 0.55) {
      quality -= 0.1;
    } else if (size > minSize) {
      size = Math.max(minSize, Math.round(size * 0.8));
      quality = 0.8;
    } else {
      break;
    }
  }

  if (!blob) throw new Error('Failed to compress image');
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}

async function loadBitmap(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to <img>
    }
  }
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img as any);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}