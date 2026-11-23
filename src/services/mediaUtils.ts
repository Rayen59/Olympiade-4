export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 Ko';
  const k = 1024;
  const sizes = ['Octets', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = () => reject(new Error('Impossible de lire le fichier.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses large camera/gallery images (e.g. 5-12MB on Android) down to ~80-180KB
 * in <100ms so problem and olympiad submissions happen instantaneously.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 1400,
  quality = 0.82
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return readFileAsDataUrl(file);
  }

  // Tiny images (<150KB) don't need re-encoding
  if (file.size <= 150 * 1024) {
    return readFileAsDataUrl(file);
  }

  try {
    let width = 0;
    let height = 0;
    let drawSource: CanvasImageSource;
    let cleanup: (() => void) | null = null;

    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
      drawSource = bitmap;
      cleanup = () => bitmap.close();
    } else {
      const objectUrl = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Image load error'));
        el.src = objectUrl;
      });
      width = img.naturalWidth || img.width;
      height = img.naturalHeight || img.height;
      drawSource = img;
      cleanup = () => URL.revokeObjectURL(objectUrl);
    }

    try {
      let targetWidth = width;
      let targetHeight = height;

      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          targetWidth = maxDimension;
          targetHeight = Math.round((height * maxDimension) / width);
        } else {
          targetHeight = maxDimension;
          targetWidth = Math.round((width * maxDimension) / height);
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, targetWidth);
      canvas.height = Math.max(1, targetHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return readFileAsDataUrl(file);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(drawSource, 0, 0, canvas.width, canvas.height);

      const outputMime = file.type === 'image/png' && file.size < 400 * 1024 ? 'image/png' : 'image/jpeg';
      return canvas.toDataURL(outputMime, quality);
    } finally {
      if (cleanup) cleanup();
    }
  } catch {
    return readFileAsDataUrl(file);
  }
}

export async function compressImageFiles(files: FileList | File[]): Promise<string[]> {
  const list = Array.from(files);
  return Promise.all(list.map((file) => compressImageFile(file)));
}
