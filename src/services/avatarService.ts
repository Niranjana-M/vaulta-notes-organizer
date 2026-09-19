import { supabase, SUPABASE_STORAGE_BUCKET } from '../lib/supabase';

export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_AVATAR_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
export const ALLOWED_AVATAR_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export interface AvatarValidationResult {
  valid: boolean;
  error?: string;
  extension?: string;
}

/**
 * Validates profile image file according to strict criteria
 */
export function validateAvatarFile(file: File): AvatarValidationResult {
  // 1. File Size Validation
  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Profile picture must be smaller than 5 MB.'
    };
  }

  // 2. Extension & Format Validation
  const nameLower = file.name.toLowerCase();
  const hasValidExtension = ALLOWED_AVATAR_EXTENSIONS.some((ext) => nameLower.endsWith(ext));
  const hasValidMime = ALLOWED_AVATAR_MIME_TYPES.includes(file.type.toLowerCase());

  if (!hasValidExtension && !hasValidMime) {
    return {
      valid: false,
      error: 'Please select a JPG, PNG, or WEBP image.'
    };
  }

  let extension = 'jpg';
  if (nameLower.endsWith('.png') || file.type === 'image/png') {
    extension = 'png';
  } else if (nameLower.endsWith('.webp') || file.type === 'image/webp') {
    extension = 'webp';
  } else if (nameLower.endsWith('.jpeg') || nameLower.endsWith('.jpg') || file.type === 'image/jpeg') {
    extension = 'jpg';
  }

  return {
    valid: true,
    extension
  };
}

/**
 * Helper to convert a File into a Data URL for instant preview or offline fallback
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads an avatar image to Supabase Storage under `avatars/{userId}/profile.{extension}`
 * using the existing client-side Supabase configuration.
 */
export async function uploadAvatarImage(userId: string, file: File): Promise<string> {
  const validation = validateAvatarFile(file);
  if (!validation.valid || !validation.extension) {
    throw new Error(validation.error || 'Invalid profile image.');
  }

  const cleanUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const extension = validation.extension;
  const storagePath = `avatars/${cleanUserId}/profile.${extension}`;
  const contentType = file.type || `image/${extension}`;

  // Read data URL in advance as a guaranteed local preview & resilient fallback
  const dataUrl = await readFileAsDataUrl(file);

  try {
    // 1. Attempt upload to Supabase Storage with upsert
    const { data, error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType,
        upsert: true
      });

    if (!error && data) {
      const { data: publicUrlData } = supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .getPublicUrl(data.path || storagePath);

      if (publicUrlData && publicUrlData.publicUrl) {
        // Cache bust query to ensure replacement displays immediately in browsers
        const downloadUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
        try {
          localStorage.setItem(`vaulta_avatar_${userId}`, downloadUrl);
        } catch (e) {
          // ignore localStorage quota errors
        }
        return downloadUrl;
      }
    }

    if (error) {
      console.warn('[AvatarService] Supabase upload note, using persistent local fallback:', error.message);
    }
  } catch (err: any) {
    console.warn('[AvatarService] Supabase network notice, using persistent local fallback:', err.message);
  }

  // 2. Reliable Fallback: store dataUrl locally for instantaneous user access
  try {
    localStorage.setItem(`vaulta_avatar_${userId}`, dataUrl);
  } catch (e) {
    // ignore
  }

  return dataUrl;
}

/**
 * Removes user avatar from Supabase Storage and clears local avatar cache
 */
export async function deleteAvatarImage(userId: string): Promise<void> {
  const cleanUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const possiblePaths = [
    `avatars/${cleanUserId}/profile.jpg`,
    `avatars/${cleanUserId}/profile.jpeg`,
    `avatars/${cleanUserId}/profile.png`,
    `avatars/${cleanUserId}/profile.webp`
  ];

  try {
    await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove(possiblePaths);
  } catch (err) {
    console.warn('[AvatarService] Note removing avatar from Supabase storage:', err);
  }

  try {
    localStorage.removeItem(`vaulta_avatar_${userId}`);
  } catch (e) {
    // ignore
  }
}
