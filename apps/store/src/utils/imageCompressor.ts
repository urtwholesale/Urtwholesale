/**
 * Client-Side Image Compressor & WebP Optimizer for Urbanrat Store
 *
 * Compresses images directly in the browser using HTML5 Canvas & WebP encoding
 * before uploading to Supabase Storage (e.g. return-evidence).
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: "image/webp" | "image/jpeg";
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  savingsPercent: number;
  formattedOriginalSize: string;
  formattedCompressedSize: string;
  width: number;
  height: number;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i] || "B"}`;
}

function isWebpSupported(): boolean {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
  } catch {
    return false;
  }
}

export async function compressImage(
  file: File,
  options: CompressImageOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.82,
    mimeType = isWebpSupported() ? "image/webp" : "image/jpeg",
  } = options;

  const originalSize = file.size;

  if (
    file.type === "image/svg+xml" ||
    file.type === "image/gif" ||
    originalSize < 35 * 1024
  ) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      savingsPercent: 0,
      formattedOriginalSize: formatBytes(originalSize),
      formattedCompressedSize: formatBytes(originalSize),
      width: 0,
      height: 0,
    };
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let targetWidth = img.naturalWidth || img.width;
      let targetHeight = img.naturalHeight || img.height;

      if (targetWidth > maxWidth || targetHeight > maxHeight) {
        const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
        targetWidth = Math.max(1, Math.round(targetWidth * ratio));
        targetHeight = Math.max(1, Math.round(targetHeight * ratio));
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) {
        resolve({
          file,
          originalSize,
          compressedSize: originalSize,
          savingsPercent: 0,
          formattedOriginalSize: formatBytes(originalSize),
          formattedCompressedSize: formatBytes(originalSize),
          width: targetWidth,
          height: targetHeight,
        });
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob || (blob.size >= originalSize && file.type === mimeType)) {
            resolve({
              file,
              originalSize,
              compressedSize: originalSize,
              savingsPercent: 0,
              formattedOriginalSize: formatBytes(originalSize),
              formattedCompressedSize: formatBytes(originalSize),
              width: targetWidth,
              height: targetHeight,
            });
            return;
          }

          const baseName =
            file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
          const extension = mimeType === "image/webp" ? "webp" : "jpg";
          const newFileName = `${baseName}.${extension}`;

          const compressedFile = new File([blob], newFileName, {
            type: mimeType,
            lastModified: Date.now(),
          });

          const compressedSize = compressedFile.size;
          const savingsPercent = Math.max(
            0,
            Math.round(((originalSize - compressedSize) / originalSize) * 100)
          );

          resolve({
            file: compressedFile,
            originalSize,
            compressedSize,
            savingsPercent,
            formattedOriginalSize: formatBytes(originalSize),
            formattedCompressedSize: formatBytes(compressedSize),
            width: targetWidth,
            height: targetHeight,
          });
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        file,
        originalSize,
        compressedSize: originalSize,
        savingsPercent: 0,
        formattedOriginalSize: formatBytes(originalSize),
        formattedCompressedSize: formatBytes(originalSize),
        width: 0,
        height: 0,
      });
    };

    img.src = objectUrl;
  });
}
