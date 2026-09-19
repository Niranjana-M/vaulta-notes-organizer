import { supabase, SUPABASE_STORAGE_BUCKET, SUPABASE_PUBLISHABLE_KEY, isSupabaseConfigured } from '../lib/supabase';
import { ResourceType } from '../types';

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB limit

export const ALLOWED_EXTENSIONS = {
  pdf: ['.pdf'],
  doc: ['.doc', '.docx'],
  image: ['.jpg', '.jpeg', '.png', '.webp']
};

const DB_NAME = 'vaulta_storage_db';
const STORE_NAME = 'files';

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'path' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeFileInLocalDB(path: string, file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        const db = await openIndexedDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const fileName = (file as File).name || '';
        const cleanPath = path.replace(/^local:\/\//, '').replace(/^\/+/, '');

        // Store under primary key
        store.put({
          path,
          dataUrl,
          name: fileName,
          type: file.type,
          date: Date.now()
        });

        // Also store normalized key variants for instant O(1) lookup
        if (cleanPath && cleanPath !== path) {
          store.put({
            path: cleanPath,
            dataUrl,
            name: fileName,
            type: file.type,
            date: Date.now()
          });
        }

        const localPrefixed = `local://${cleanPath}`;
        if (localPrefixed !== path && localPrefixed !== cleanPath) {
          store.put({
            path: localPrefixed,
            dataUrl,
            name: fileName,
            type: file.type,
            date: Date.now()
          });
        }

        tx.oncomplete = () => resolve(dataUrl);
        tx.onerror = () => resolve(dataUrl);
      } catch (e) {
        resolve(dataUrl);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file for storage'));
    reader.readAsDataURL(file);
  });
}

export async function getFileFromLocalDB(path: string, fileNameHint?: string): Promise<string | null> {
  if (!path && !fileNameHint) return null;
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const candidateKeys = new Set<string>();
      if (path) {
        candidateKeys.add(path);
        const cleanPath = path.replace(/^local:\/\//, '').replace(/^\/+/, '');
        candidateKeys.add(cleanPath);
        candidateKeys.add(`local://${cleanPath}`);
        candidateKeys.add(`/${cleanPath}`);
        const withoutVaulta = cleanPath.replace(/^vaulta-files\//, '');
        candidateKeys.add(withoutVaulta);
        candidateKeys.add(`vaulta-files/${withoutVaulta}`);
        candidateKeys.add(`local://${withoutVaulta}`);
      }
      if (fileNameHint) {
        candidateKeys.add(fileNameHint.trim());
      }

      const keysArray = Array.from(candidateKeys);
      let index = 0;

      const checkNextKey = () => {
        if (index >= keysArray.length) {
          // Direct keys not found, scan all records in the store
          scanAllRecords();
          return;
        }
        const key = keysArray[index++];
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result?.dataUrl) {
            resolve(req.result.dataUrl);
          } else {
            checkNextKey();
          }
        };
        req.onerror = () => checkNextKey();
      };

      const scanAllRecords = () => {
        try {
          const allReq = store.getAll();
          allReq.onsuccess = () => {
            const records: any[] = allReq.result || [];
            if (records.length === 0) {
              resolve(null);
              return;
            }

            const targetName = (fileNameHint || '').trim().toLowerCase();
            const pathParts = (path || '').split('/');
            const lastSegment = pathParts[pathParts.length - 1]?.toLowerCase() || '';
            const timestampMatch = (path || '').match(/\d{10,14}/)?.[0] || '';

            // 1. Exact match on record name
            if (targetName) {
              const matched = records.find(
                (r) => r.name && r.name.toLowerCase() === targetName
              );
              if (matched?.dataUrl) return resolve(matched.dataUrl);
            }

            // 2. Match on path segment (contains unique generated prefix or filename)
            if (lastSegment) {
              const matched = records.find(
                (r) => r.path && r.path.toLowerCase().includes(lastSegment)
              );
              if (matched?.dataUrl) return resolve(matched.dataUrl);
            }

            // 3. Match on unique timestamp in path
            if (timestampMatch) {
              const matched = records.find(
                (r) => r.path && r.path.includes(timestampMatch)
              );
              if (matched?.dataUrl) return resolve(matched.dataUrl);
            }

            // 4. Loose match on filename without extension
            if (targetName) {
              const baseName = targetName.replace(/\.[^/.]+$/, '');
              if (baseName.length > 3) {
                const matched = records.find(
                  (r) =>
                    (r.name && r.name.toLowerCase().includes(baseName)) ||
                    (r.path && r.path.toLowerCase().includes(baseName))
                );
                if (matched?.dataUrl) return resolve(matched.dataUrl);
              }
            }

            resolve(null);
          };
          allReq.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };

      checkNextKey();
    });
  } catch (e) {
    return null;
  }
}

export function getMimeTypeFromFileName(fileName: string, defaultType?: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return defaultType || 'application/octet-stream';
}

export function getResourceTypeFromFileName(fileName: string): ResourceType | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'doc';
  if (
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp')
  ) {
    return 'image';
  }
  return null;
}

/**
 * Universal helper to detect if any resource is a Word document (.doc, .docx, application/msword, etc.)
 */
export function isWordDoc(resource?: {
  resourceType?: string;
  fileName?: string;
  mimeType?: string;
  title?: string;
}): boolean {
  if (!resource) return false;
  const t = (resource.resourceType || '').toLowerCase();
  if (t === 'doc' || t === 'docx' || t === 'word') return true;
  const name = (resource.fileName || resource.title || '').toLowerCase();
  if (name.endsWith('.doc') || name.endsWith('.docx')) return true;
  const mime = (resource.mimeType || '').toLowerCase();
  if (
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime.includes('wordprocessingml') ||
    mime.includes('msword')
  ) {
    return true;
  }
  return false;
}

export function isPdfDoc(resource?: {
  resourceType?: string;
  fileName?: string;
  mimeType?: string;
  title?: string;
}): boolean {
  if (!resource) return false;
  const t = (resource.resourceType || '').toLowerCase();
  if (t === 'pdf') return true;
  const name = (resource.fileName || resource.title || '').toLowerCase();
  if (name.endsWith('.pdf')) return true;
  const mime = (resource.mimeType || '').toLowerCase();
  return mime === 'application/pdf';
}

export function isImageDoc(resource?: {
  resourceType?: string;
  fileName?: string;
  mimeType?: string;
  title?: string;
}): boolean {
  if (!resource) return false;
  const t = (resource.resourceType || '').toLowerCase();
  if (t === 'image' || t === 'img') return true;
  const name = (resource.fileName || resource.title || '').toLowerCase();
  if (
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp')
  ) {
    return true;
  }
  const mime = (resource.mimeType || '').toLowerCase();
  return mime.startsWith('image/');
}

export function validateFile(file: File): { valid: boolean; error?: string; type?: ResourceType } {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size is 50MB.`
    };
  }

  const type = getResourceTypeFromFileName(file.name);
  if (!type) {
    return {
      valid: false,
      error: `Unsupported file format. Vaulta supports PDF, DOC, DOCX, JPG, JPEG, PNG, and WEBP.`
    };
  }

  return { valid: true, type };
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Generates a safe storage path for Supabase Storage and IndexedDB
 */
export function generateSafeStoragePath(userId: string, subjectId: string | undefined, fileName: string): string {
  const cleanUser = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanSubject = (subjectId || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  // Replace spaces, parentheses, brackets, and unsafe characters with underscores for storage key
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${cleanUser}/${cleanSubject}/${timestamp}_${randomSuffix}_${cleanFileName}`;
}

/**
 * Uploads a file directly to Supabase Storage in the 'vaulta-files' bucket.
 * Seamlessly falls back to durable local storage if Supabase network / CORS fails.
 */
export function uploadFileToStorage(
  userId: string,
  subjectId: string | undefined,
  file: File,
  onProgress: (percent: number) => void
): { promise: Promise<{ downloadUrl: string; storagePath: string; mimeType: string; isLocalFallback?: boolean; supabaseResult?: string }>; cancel: () => void } {
  let isCancelled = false;
  let progressInterval: any = null;

  // Generate safe storage path
  const storagePath = generateSafeStoragePath(userId, subjectId, file.name);

  const promise = new Promise<{ downloadUrl: string; storagePath: string; mimeType: string; isLocalFallback?: boolean; supabaseResult?: string }>(
    async (resolve, reject) => {
      try {
        onProgress(10);

        // Smooth progress simulator while uploading
        let currentPct = 10;
        progressInterval = setInterval(() => {
          if (currentPct < 80) {
            currentPct += Math.floor(Math.random() * 12) + 6;
            if (currentPct > 80) currentPct = 80;
            onProgress(currentPct);
          }
        }, 120);

        if (isCancelled) {
          clearInterval(progressInterval);
          reject(new Error('Upload cancelled by user.'));
          return;
        }

        const mimeType =
          file.type && file.type !== 'application/octet-stream'
            ? file.type
            : getMimeTypeFromFileName(file.name);

        // Attempt Supabase upload if Supabase is configured
        let uploadSucceeded = false;
        let supabaseDownloadUrl = '';
        let supabaseStoragePath = storagePath;
        let supabaseUploadStatus = 'Local only';

        if (isSupabaseConfigured()) {
          try {
            const { data, error } = await supabase.storage
              .from(SUPABASE_STORAGE_BUCKET)
              .upload(storagePath, file, {
                contentType: mimeType,
                upsert: false
              });

            if (!error && data) {
              uploadSucceeded = true;
              supabaseStoragePath = data.path || storagePath;
              const { data: publicUrlData } = supabase.storage
                .from(SUPABASE_STORAGE_BUCKET)
                .getPublicUrl(supabaseStoragePath);
              supabaseDownloadUrl = publicUrlData.publicUrl;
              supabaseUploadStatus = `Success (bucket: ${SUPABASE_STORAGE_BUCKET}, path: ${supabaseStoragePath})`;
            } else if (error) {
              supabaseUploadStatus = `Notice: ${error.message}`;
            }
          } catch (fetchErr: any) {
            supabaseUploadStatus = `Network Notice: ${fetchErr.message}`;
          }
        }

        clearInterval(progressInterval);

        if (isCancelled) {
          if (uploadSucceeded) {
            await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([supabaseStoragePath]).catch(() => {});
          }
          reject(new Error('Upload cancelled by user.'));
          return;
        }

        onProgress(90);

        if (uploadSucceeded && supabaseDownloadUrl) {
          onProgress(100);
          resolve({
            downloadUrl: supabaseDownloadUrl,
            storagePath: supabaseStoragePath,
            mimeType,
            supabaseResult: supabaseUploadStatus
          });
          return;
        }

        // Fallback: Save file reliably in local IndexedDB storage
        await storeFileInLocalDB(storagePath, file);
        onProgress(100);

        console.log('[StorageService] Stored file in local IndexedDB:', storagePath);

        resolve({
          downloadUrl: `local://${storagePath}`,
          storagePath: `local://${storagePath}`,
          mimeType,
          isLocalFallback: true,
          supabaseResult: supabaseUploadStatus
        });
      } catch (err: any) {
        clearInterval(progressInterval);
        console.error('Upload processing error:', err);
        // Emergency direct file read fallback
        try {
          await storeFileInLocalDB(storagePath, file);
          resolve({
            downloadUrl: `local://${storagePath}`,
            storagePath: `local://${storagePath}`,
            mimeType: file.type || 'application/octet-stream',
            isLocalFallback: true,
            supabaseResult: 'Local IndexedDB fallback due to error'
          });
        } catch (e) {
          reject(new Error(err.message || 'Failed to upload file.'));
        }
      }
    }
  );

  return {
    promise,
    cancel: () => {
      isCancelled = true;
      if (progressInterval) clearInterval(progressInterval);
    }
  };
}

/**
 * Downloads a Word document or resource file seamlessly as a Blob with original filename
 */
export async function downloadResourceFile(resource: {
  fileName?: string;
  title: string;
  fileUrl?: string;
  storagePath?: string;
  mimeType?: string;
  resourceType?: string;
}): Promise<void> {
  let fileName = (resource.fileName || resource.title || 'document').trim();

  // Ensure file extension matches format if missing in title
  const fileNameLower = fileName.toLowerCase();
  if (!fileNameLower.endsWith('.docx') && !fileNameLower.endsWith('.doc') && !fileNameLower.endsWith('.pdf') && !fileNameLower.endsWith('.jpg') && !fileNameLower.endsWith('.jpeg') && !fileNameLower.endsWith('.png') && !fileNameLower.endsWith('.webp')) {
    if (isWordDoc(resource)) {
      fileName = `${fileName}.docx`;
    } else if (isPdfDoc(resource)) {
      fileName = `${fileName}.pdf`;
    } else if (isImageDoc(resource)) {
      const mime = (resource.mimeType || '').toLowerCase();
      const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      fileName = `${fileName}.${ext}`;
    }
  }

  let downloadError: Error | null = null;

  const triggerDownload = (blob: Blob) => {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 10000);
  };

  try {
    // 1. Check local IndexedDB storage
    if (resource.storagePath?.startsWith('local://') || resource.fileUrl?.startsWith('local://')) {
      const cleanPath = (resource.storagePath || resource.fileUrl || '').replace('local://', '');
      const localDataUrl = await getFileFromLocalDB(cleanPath, fileName);
      if (localDataUrl) {
        const res = await fetch(localDataUrl);
        if (res.ok) {
          const blob = await res.blob();
          triggerDownload(blob);
          return;
        }
      }
    }

    // 2. Direct Supabase Storage download as Blob
    if (isSupabaseConfigured() && resource.storagePath && !resource.storagePath.startsWith('local://')) {
      const cleanStoragePath = resource.storagePath
        .replace(/^vaulta-files\//, '')
        .replace(/^\//, '');

      try {
        const { data, error } = await supabase.storage
          .from(SUPABASE_STORAGE_BUCKET)
          .download(cleanStoragePath);

        if (!error && data) {
          const mime = resource.mimeType || (fileName.endsWith('.docx')
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : fileName.endsWith('.doc')
            ? 'application/msword'
            : fileName.endsWith('.png')
            ? 'image/png'
            : fileName.endsWith('.webp')
            ? 'image/webp'
            : fileName.endsWith('.jpeg') || fileName.endsWith('.jpg')
            ? 'image/jpeg'
            : 'application/octet-stream');
          const typedBlob = new Blob([data], { type: mime });
          triggerDownload(typedBlob);
          return;
        }
      } catch {
        // Ignore Supabase download error
      }
    }

    // 3. HTTP/HTTPS URL fetch as Blob (excluding unresolvable placeholder domains)
    if (
      resource.fileUrl &&
      (resource.fileUrl.startsWith('http://') || resource.fileUrl.startsWith('https://')) &&
      !resource.fileUrl.includes('kqgawuyrbyzsimawxrtc')
    ) {
      try {
        const response = await fetch(resource.fileUrl);
        if (response.ok) {
          const blob = await response.blob();
          triggerDownload(blob);
          return;
        }
      } catch {
        // Ignore URL fetch error
      }
    }

    // 4. Data URL or Blob URL direct download
    if (resource.fileUrl && (resource.fileUrl.startsWith('data:') || resource.fileUrl.startsWith('blob:'))) {
      const res = await fetch(resource.fileUrl);
      if (res.ok) {
        const blob = await res.blob();
        triggerDownload(blob);
        return;
      }
    }

    // 5. Fallback check in IndexedDB using storagePath if previous steps missed it
    if (resource.storagePath) {
      const cleanPath = resource.storagePath.replace(/^local:\/\//, '').replace(/^vaulta-files\//, '');
      const localDataUrl = await getFileFromLocalDB(cleanPath, fileName);
      if (localDataUrl) {
        const res = await fetch(localDataUrl);
        if (res.ok) {
          const blob = await res.blob();
          triggerDownload(blob);
          return;
        }
      }
    }
  } catch (err: any) {
    downloadError = err;
    console.error('[StorageService] Download resource error:', err);
  }

  // If all attempts failed, throw a descriptive error without opening a viewer
  const errorMessage = downloadError?.message || `Failed to download "${fileName}". The file could not be retrieved from storage.`;
  throw new Error(errorMessage);
}

/**
 * Deletes a file from Supabase Storage or Local Storage
 */
export async function deleteFileFromStorage(storagePath: string): Promise<void> {
  if (!storagePath) return;
  try {
    if (storagePath.startsWith('local://')) {
      const cleanPath = storagePath.replace('local://', '');
      try {
        const db = await openIndexedDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(cleanPath);
      } catch (e) {
        // ignore
      }
      return;
    }

    const cleanPath = storagePath.startsWith('vaulta-files/')
      ? storagePath.replace('vaulta-files/', '')
      : storagePath;

    const { error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .remove([cleanPath]);

    if (error) {
      console.warn('Could not delete Supabase storage object:', error);
    }
  } catch (error: any) {
    console.warn('Error in deleteFileFromStorage:', error);
  }
}

/**
 * Normalizes and resolves MIME type for image resources.
 * Supports PNG, JPG, JPEG, and WEBP.
 */
export function getImageMimeType(fileName?: string, rawMime?: string): string {
  if (rawMime && rawMime.startsWith('image/')) {
    return rawMime;
  }
  const lower = (fileName || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
}

/**
 * Retrieves the raw image Blob from storage.
 * Reuses the EXACT same Supabase Storage bucket ('vaulta-files'),
 * storage path resolution, Supabase client, and server-side shared file proxy
 * that the working Download button and downloadResourceFile use.
 */
export async function retrieveImageBlob(
  resource: {
    fileName?: string;
    title: string;
    fileUrl?: string;
    storagePath?: string;
    mimeType?: string;
    resourceType?: string;
  },
  explicitShareId?: string
): Promise<Blob> {
  const fileName = resource.fileName || resource.title || 'image.jpg';
  const targetMime = getImageMimeType(fileName, resource.mimeType);

  // 1. Server-side proxy retrieval for shared files
  // If viewing a shared resource, this securely fetches the original image bytes
  // without requiring recipient authentication or public storage buckets.
  const detectedShareId =
    explicitShareId ||
    (resource as any).shareId ||
    (typeof window !== 'undefined'
      ? window.location.pathname.match(/\/shared\/([^/?#]+)/)?.[1]
      : '');

  if (detectedShareId) {
    try {
      const response = await fetch(`/api/shared-file/${encodeURIComponent(detectedShareId)}`);
      if (response.ok) {
        const rawBlob = await response.blob();
        if (rawBlob && rawBlob.size > 0) {
          const finalMime = rawBlob.type && rawBlob.type.startsWith('image/') ? rawBlob.type : targetMime;
          return new Blob([rawBlob], { type: finalMime });
        }
      }
    } catch (proxyErr) {
      console.warn('[StorageService] Server proxy shared image fetch notice:', proxyErr);
    }
  }

  // 2. Data URL or existing Blob URL
  if (resource.fileUrl && (resource.fileUrl.startsWith('data:') || resource.fileUrl.startsWith('blob:'))) {
    try {
      const res = await fetch(resource.fileUrl);
      if (res.ok) {
        const rawBlob = await res.blob();
        if (rawBlob && rawBlob.size > 0) {
          return new Blob([rawBlob], { type: targetMime });
        }
      }
    } catch {
      // Ignore data/blob URL fetch error
    }
  }

  // 3. Local IndexedDB storage (if local://)
  if (resource.storagePath?.startsWith('local://') || resource.fileUrl?.startsWith('local://')) {
    const cleanPath = (resource.storagePath || resource.fileUrl || '').replace('local://', '');
    try {
      const localDataUrl = await getFileFromLocalDB(cleanPath, fileName);
      if (localDataUrl) {
        const res = await fetch(localDataUrl);
        if (res.ok) {
          const rawBlob = await res.blob();
          if (rawBlob && rawBlob.size > 0) {
            return new Blob([rawBlob], { type: targetMime });
          }
        }
      }
    } catch {
      // Ignore local fetch error
    }
  }

  // 4. Supabase Storage: Reuses the exact same bucket ('vaulta-files') and clean storage path
  let cleanStoragePath = (resource.storagePath || '')
    .replace(/^vaulta-files\//, '')
    .replace(/^local:\/\//, '')
    .replace(/^\/+/, '');

  if (!cleanStoragePath && resource.fileUrl?.includes('vaulta-files/')) {
    const parts = resource.fileUrl.split('vaulta-files/');
    if (parts[1]) {
      cleanStoragePath = parts[1].split('?')[0];
    }
  }

  if (isSupabaseConfigured() && cleanStoragePath && !resource.storagePath?.startsWith('local://')) {
    // 4a. Supabase signed URL download (valid for 3600 seconds)
    try {
      const { data: signedData, error: signedErr } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .createSignedUrl(cleanStoragePath, 3600);

      if (!signedErr && signedData?.signedUrl) {
        const res = await fetch(signedData.signedUrl);
        if (res.ok) {
          const rawBlob = await res.blob();
          if (rawBlob && rawBlob.size > 0) {
            return new Blob([rawBlob], { type: targetMime });
          }
        }
      }
    } catch {
      // Ignore signed URL error
    }

    // 4b. Direct Supabase Storage download as Blob (the EXACT same call used by downloadResourceFile)
    try {
      const { data, error } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .download(cleanStoragePath);

      if (!error && data && data.size > 0) {
        return new Blob([data], { type: targetMime });
      }
    } catch {
      // Ignore Supabase download error
    }

    // 4c. Derived Supabase Public URL fetch
    try {
      const { data: pubData } = supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .getPublicUrl(cleanStoragePath);

      if (pubData?.publicUrl) {
        const res = await fetch(pubData.publicUrl);
        if (res.ok) {
          const rawBlob = await res.blob();
          if (rawBlob && rawBlob.size > 0) {
            return new Blob([rawBlob], { type: targetMime });
          }
        }
      }
    } catch {
      // Ignore public URL error
    }
  }

  // 5. Direct HTTP/HTTPS fetch from resource.fileUrl (excluding unresolvable placeholder domains)
  if (
    resource.fileUrl &&
    (resource.fileUrl.startsWith('http://') || resource.fileUrl.startsWith('https://')) &&
    !resource.fileUrl.includes('kqgawuyrbyzsimawxrtc')
  ) {
    try {
      const response = await fetch(resource.fileUrl);
      if (response.ok) {
        const rawBlob = await response.blob();
        if (rawBlob && rawBlob.size > 0) {
          return new Blob([rawBlob], { type: targetMime });
        }
      }
    } catch {
      // Ignore URL fetch error
    }
  }

  // 6. Final fallback: try IndexedDB with storagePath directly
  if (resource.storagePath) {
    try {
      const fallbackUrl = await getFileFromLocalDB(resource.storagePath, fileName);
      if (fallbackUrl) {
        const res = await fetch(fallbackUrl);
        if (res.ok) {
          const rawBlob = await res.blob();
          if (rawBlob && rawBlob.size > 0) {
            return new Blob([rawBlob], { type: targetMime });
          }
        }
      }
    } catch {
      // Ignore fallback error
    }
  }

  throw new Error('Unable to load image file from storage.');
}

