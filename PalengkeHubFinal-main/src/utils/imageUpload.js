// src/utils/imageUpload.js
// ============================================================
// Shared, cross-platform image upload helper for Supabase Storage.
//
// Why this exists:
//  - On the web, expo-image-picker returns a `File`/`Blob` and
//    uploads work out of the box.
//  - On native (Android/iOS), passing `{ uri, name, type }` as the
//    upload body is NOT reliable with @supabase/storage-js. The
//    correct, documented approach is to read the file into an
//    ArrayBuffer (via expo-file-system) and upload the raw bytes.
// ============================================================

import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { supabase } from '../../lib/supabase';

export const IMAGE_BUCKET = 'product_images';

/**
 * Best-effort file extension derived from the URI / MIME type.
 */
export function getImageExtension(uri, mimeType) {
  if (typeof uri === 'string') {
    const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
    if (match) {
      return match[1].toLowerCase().replace('jpeg', 'jpg');
    }
  }
  if (typeof mimeType === 'string' && mimeType.includes('/')) {
    const fromMime = mimeType.split('/').pop().toLowerCase();
    if (fromMime && fromMime !== 'octet-stream') {
      return fromMime.replace('jpeg', 'jpg');
    }
  }
  return 'jpg';
}

/**
 * Maps an extension to a proper Content-Type header.
 */
export function normalizeContentType(ext) {
  const e = String(ext || 'jpg').toLowerCase();
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
  if (e === 'png') return 'image/png';
  if (e === 'webp') return 'image/webp';
  if (e === 'gif') return 'image/gif';
  if (e === 'svg') return 'image/svg+xml';
  if (e === 'heic') return 'image/heic';
  if (e === 'heif') return 'image/heif';
  if (e === 'bmp') return 'image/bmp';
  return `image/${e}`;
}

/**
 * Converts a base64 string to an ArrayBuffer without any dependency
 * (no `atob` needed — some RN runtimes don't have it).
 */
function base64ToArrayBuffer(base64) {
  const clean = String(base64 || '')
    .replace(/^data:[^;]+;base64,/, '')
    .replace(/[\r\n\s]/g, '');

  if (!clean.length) {
    throw new Error('Image is empty (unable to read file contents).');
  }

  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = {};
  for (let i = 0; i < alphabet.length; i += 1) lookup[alphabet[i]] = i;

  const bytes = [];
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (ch === '=') break;
    const val = lookup[ch];
    if (val === undefined) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return new Uint8Array(bytes).buffer;
}

/**
 * Native only: read a local image file into an ArrayBuffer.
 * Uses the expo-file-system `File` class, falling back to a fetch-based
 * read if that is unavailable.
 */
async function readLocalFileAsArrayBuffer(uri) {
  try {
    const imageFile = new File(uri);
    if (imageFile && typeof imageFile.base64 === 'function') {
      const base64 = await imageFile.base64();
      if (base64 && base64.length > 0) {
        return base64ToArrayBuffer(base64);
      }
    }
  } catch (err) {
    console.warn(
      '[imageUpload] expo-file-system File.base64() failed, trying fallback:',
      err
    );
  }

  // Fallback (works on web and most RN runtimes):
  const response = await fetch(uri);
  return await response.arrayBuffer();
}

/**
 * Upload an image to Supabase Storage and return the public URL.
 *
 * @param {Object} options
 * @param {string} options.uri            Local URI from the image picker.
 * @param {string} [options.folder]       Folder inside the bucket, e.g. 'products'.
 * @param {string} [options.fileName]     Optional explicit file name.
 * @param {string} [options.mimeType]     E.g. 'image/jpeg'.
 * @param {*}      [options.fileAsset]    Web `File`/`Blob` object (optional).
 * @param {string} [options.bucket]       Bucket name (defaults to 'product_images').
 * @param {boolean}[options.upsert]       Allow overwriting an existing path.
 * @returns {Promise<{path: string, url: string, name: string}>}
 */
export async function uploadImageToStorage({
  uri,
  folder = 'images',
  fileName,
  mimeType,
  fileAsset,
  bucket = IMAGE_BUCKET,
  upsert = false,
}) {
  if (!uri && !fileAsset) {
    throw new Error('No image was provided to upload.');
  }

  const ext = getImageExtension(uri, mimeType);
  const contentType = mimeType || normalizeContentType(ext);
  const safeFolder = String(folder || 'image').replace(/[^a-zA-Z0-9_-]/g, '_');
  const name =
    fileName ||
    `${safeFolder}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const cleanFolder = String(folder || '').replace(/^\/+|\/+$/g, '');
  const path = cleanFolder ? `${cleanFolder}/${name}` : name;

  let fileBody;
  if (Platform.OS === 'web') {
    if (fileAsset) {
      // Real File/Blob from expo-image-picker on web
      fileBody = fileAsset;
    } else {
      const response = await fetch(uri);
      fileBody = await response.blob();
    }
  } else {
    fileBody = await readLocalFileAsArrayBuffer(uri);
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, fileBody, { contentType, upsert });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

  return {
    path: data?.path || path,
    url: (urlData && urlData.publicUrl) || null,
    name,
  };
}

/**
 * Removes an object from storage. Useful when replacing/removing photos.
 */
export async function deleteImageFromStorage(path, bucket = IMAGE_BUCKET) {
  if (!path) return null;
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return error || null;
}

/**
 * Returns the public URL for an existing storage path.
 */
export function getPublicImageUrl(path, bucket = IMAGE_BUCKET) {
  if (!path) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return (data && data.publicUrl) || null;
}
