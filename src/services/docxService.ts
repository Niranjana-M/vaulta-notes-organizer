import mammoth from 'mammoth';
import { supabase, SUPABASE_STORAGE_BUCKET, SUPABASE_PUBLISHABLE_KEY, isSupabaseConfigured } from '../lib/supabase';
import { getFileFromLocalDB } from './storageService';
import { StudyResource } from '../types';

export interface RetrievedDocx {
  buffer: ArrayBuffer;
  blob: Blob;
  isLegacyDoc: boolean;
  source: string;
}

/**
 * Checks whether a buffer represents an HTML or JSON error response rather than real document data.
 */
export function isHtmlOrJsonBuffer(buffer: ArrayBuffer): boolean {
  if (!buffer || buffer.byteLength < 4) return false;
  const slice = new Uint8Array(buffer.slice(0, Math.min(buffer.byteLength, 256)));
  let text = '';
  for (let i = 0; i < slice.length; i++) {
    text += String.fromCharCode(slice[i]);
  }
  const clean = text.trimStart().toLowerCase();
  return (
    clean.startsWith('<!doctype') ||
    clean.startsWith('<html') ||
    clean.startsWith('<head') ||
    clean.startsWith('<?xml') ||
    clean.startsWith('<error') ||
    clean.startsWith('{"error') ||
    clean.startsWith('{"status') ||
    clean.startsWith('{"message')
  );
}

/**
 * Checks whether a buffer represents a valid DOCX file (ZIP archive starting with PK: 0x50, 0x4b)
 */
export function isValidDocxBuffer(buffer: ArrayBuffer): boolean {
  if (!buffer || buffer.byteLength < 4) return false;
  if (isHtmlOrJsonBuffer(buffer)) return false;
  const bytes = new Uint8Array(buffer);
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

/**
 * Checks whether a buffer represents a legacy Word binary file (.doc), RTF, or non-ZIP Word format.
 */
export function isLegacyDocBuffer(buffer: ArrayBuffer): boolean {
  if (!buffer || buffer.byteLength < 4) return false;
  if (isHtmlOrJsonBuffer(buffer)) return false;

  // If it's a valid ZIP archive (starting with PK), it's a DOCX format, not legacy .doc
  if (isValidDocxBuffer(buffer)) {
    return false;
  }

  // Any non-ZIP Word document buffer is a legacy / non-ZIP format (.doc, RTF, binary Word)
  return true;
}

/**
 * Internal helper to verify that a downloaded ArrayBuffer contains real document data
 */
function isValidDocumentData(buffer: ArrayBuffer): boolean {
  if (!buffer || buffer.byteLength < 16) return false;
  if (isHtmlOrJsonBuffer(buffer)) return false;
  return true;
}

/**
 * Retrieves the raw DOCX binary ArrayBuffer and Blob from Supabase Storage,
 * public HTTP endpoints, data/blob URLs, or local IndexedDB fallback.
 */
export async function retrieveDocxBytes(
  resource: StudyResource,
  explicitShareId?: string
): Promise<RetrievedDocx> {
  const fileNameHint = resource.fileName || resource.title || 'document.docx';

  // 0. Server-side proxy retrieval for shared files
  // If viewing a shared resource, this securely fetches the original file bytes
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
        const buffer = await response.arrayBuffer();
        if (isValidDocumentData(buffer)) {
          const isLegacy = isLegacyDocBuffer(buffer);
          return {
            buffer,
            blob: new Blob([buffer], {
              type: isLegacy
                ? 'application/msword'
                : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            }),
            isLegacyDoc: isLegacy,
            source: 'server-shared-proxy'
          };
        }
      }
    } catch (apiErr) {
      console.warn('[DocxService] Server proxy shared file fetch notice:', apiErr);
    }
  }

  // 1. Data URL
  if (resource.fileUrl?.startsWith('data:')) {
    try {
      const response = await fetch(resource.fileUrl);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        if (isValidDocumentData(buffer)) {
          const isLegacy = isLegacyDocBuffer(buffer);
          return {
            buffer,
            blob: new Blob([buffer], {
              type: isLegacy
                ? 'application/msword'
                : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            }),
            isLegacyDoc: isLegacy,
            source: 'data-url'
          };
        }
      }
    } catch (err) {
      console.warn('[DocxService] Data URL fetch notice:', err);
    }
  }

  // 2. Blob URL
  if (resource.fileUrl?.startsWith('blob:')) {
    try {
      const response = await fetch(resource.fileUrl);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        if (isValidDocumentData(buffer)) {
          const isLegacy = isLegacyDocBuffer(buffer);
          return {
            buffer,
            blob: new Blob([buffer], {
              type: isLegacy
                ? 'application/msword'
                : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            }),
            isLegacyDoc: isLegacy,
            source: 'blob-url'
          };
        }
      }
    } catch (err) {
      console.warn('[DocxService] Blob URL fetch notice:', err);
    }
  }

  // Extract clean storage path
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

  // 3. Supabase Storage (Only attempted when configured with valid keys and not marked local)
  const isLocal =
    resource.storagePath?.startsWith('local://') ||
    resource.fileUrl?.startsWith('local://');

  if (isSupabaseConfigured() && !isLocal && cleanStoragePath) {
    // 3a. Supabase signed URL download
    try {
      const { data: signedData, error: signedErr } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .createSignedUrl(cleanStoragePath, 3600);

      if (!signedErr && signedData?.signedUrl) {
        const response = await fetch(signedData.signedUrl);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          if (isValidDocumentData(buffer)) {
            const isLegacy = isLegacyDocBuffer(buffer);
            return {
              buffer,
              blob: new Blob([buffer], {
                type: isLegacy
                  ? 'application/msword'
                  : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              }),
              isLegacyDoc: isLegacy,
              source: 'supabase-signed-url'
            };
          }
        }
      }
    } catch {
      // Ignore signed url error
    }

    // 3b. Supabase Storage SDK download
    try {
      const { data, error } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .download(cleanStoragePath);

      if (!error && data) {
        const buffer = await data.arrayBuffer();
        if (isValidDocumentData(buffer)) {
          const isLegacy = isLegacyDocBuffer(buffer);
          return {
            buffer,
            blob: new Blob([buffer], {
              type: isLegacy
                ? 'application/msword'
                : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            }),
            isLegacyDoc: isLegacy,
            source: 'supabase-sdk-download'
          };
        }
      }
    } catch {
      // Ignore SDK download error
    }

    // 3c. Derived Supabase Storage Public URL with optional auth headers
    try {
      const { data: pubData } = supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .getPublicUrl(cleanStoragePath);

      if (pubData?.publicUrl) {
        const headers: Record<string, string> = {};
        if (SUPABASE_PUBLISHABLE_KEY) {
          headers['apikey'] = SUPABASE_PUBLISHABLE_KEY;
          headers['Authorization'] = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;
        }
        const response = await fetch(pubData.publicUrl, {
          method: 'GET',
          mode: 'cors',
          headers: Object.keys(headers).length > 0 ? headers : undefined
        });
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          if (isValidDocumentData(buffer)) {
            const isLegacy = isLegacyDocBuffer(buffer);
            return {
              buffer,
              blob: new Blob([buffer], {
                type: isLegacy
                  ? 'application/msword'
                  : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              }),
              isLegacyDoc: isLegacy,
              source: 'supabase-public-url'
            };
          }
        }
      }
    } catch {
      // Ignore public url error
    }
  }

  // 4. Direct Public HTTP / HTTPS URL fetch from resource.fileUrl (excluding unresolvable placeholder domains)
  if (
    resource.fileUrl &&
    (resource.fileUrl.startsWith('http://') || resource.fileUrl.startsWith('https://')) &&
    !resource.fileUrl.includes('kqgawuyrbyzsimawxrtc')
  ) {
    try {
      const response = await fetch(resource.fileUrl, { method: 'GET', mode: 'cors' });
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        if (isValidDocumentData(buffer)) {
          const isLegacy = isLegacyDocBuffer(buffer);
          return {
            buffer,
            blob: new Blob([buffer], {
              type: isLegacy
                ? 'application/msword'
                : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            }),
            isLegacyDoc: isLegacy,
            source: 'direct-http'
          };
        }
      }
    } catch (err) {
      console.warn('[DocxService] Direct HTTP fetch notice:', err);
    }
  }

  // 5. Local IndexedDB persistent storage fallback
  const lookupKeys: string[] = [];
  if (resource.storagePath) lookupKeys.push(resource.storagePath);
  if (cleanStoragePath) lookupKeys.push(cleanStoragePath);
  if (resource.fileUrl?.startsWith('local://')) lookupKeys.push(resource.fileUrl);

  for (const candidateKey of lookupKeys) {
    try {
      const localDataUrl = await getFileFromLocalDB(candidateKey, fileNameHint);
      if (localDataUrl) {
        const response = await fetch(localDataUrl);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          if (isValidDocumentData(buffer)) {
            const isLegacy = isLegacyDocBuffer(buffer);
            return {
              buffer,
              blob: new Blob([buffer], {
                type: isLegacy
                  ? 'application/msword'
                  : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              }),
              isLegacyDoc: isLegacy,
              source: 'local-indexeddb'
            };
          }
        }
      }
    } catch (idbErr) {
      console.warn('[DocxService] IndexedDB fetch notice:', idbErr);
    }
  }

  // Final IndexedDB search by filename hint
  if (fileNameHint) {
    try {
      const localDataUrl = await getFileFromLocalDB('', fileNameHint);
      if (localDataUrl) {
        const response = await fetch(localDataUrl);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          if (isValidDocumentData(buffer)) {
            const isLegacy = isLegacyDocBuffer(buffer);
            return {
              buffer,
              blob: new Blob([buffer], {
                type: isLegacy
                  ? 'application/msword'
                  : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              }),
              isLegacyDoc: isLegacy,
              source: 'local-indexeddb-hint'
            };
          }
        }
      }
    } catch (hintErr) {
      console.warn('[DocxService] IndexedDB filename search notice:', hintErr);
    }
  }

  throw new Error('Unable to retrieve DOCX file from storage or network.');
}

export interface DocxHtmlResult {
  html: string;
  messages: string[];
}

/**
 * Converts DOCX ArrayBuffer to clean, semantic HTML using Mammoth.js.
 * Preserves paragraphs, headings, bold, italics, underline, lists, tables, and images.
 */
export async function convertDocxToHtml(arrayBuffer: ArrayBuffer): Promise<DocxHtmlResult> {
  if (!arrayBuffer || arrayBuffer.byteLength < 16) {
    throw new Error('Document buffer is empty or corrupted.');
  }

  // Pre-validate that this is a valid ZIP/DOCX format (starts with PK)
  if (!isValidDocxBuffer(arrayBuffer)) {
    throw new Error("LEGACY_DOC_NON_ZIP: File is not a ZIP archive. It may be a legacy Word (.doc) format.");
  }

  const options = {
    arrayBuffer,
    styleMap: [
      "u => u",
      "strike => s",
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "p[style-name='Heading 4'] => h4:fresh",
      "p[style-name='Heading 5'] => h5:fresh",
      "p[style-name='Heading 6'] => h6:fresh",
      "p[style-name='Title'] => h1.doc-title:fresh",
      "p[style-name='Subtitle'] => p.doc-subtitle:fresh",
      "r[style-name='Strong'] => strong",
      "r[style-name='Emphasis'] => em"
    ],
    convertImage: mammoth.images.imgElement((image) => {
      return image.read('base64').then((imageBuffer) => {
        return {
          src: `data:${image.contentType};base64,${imageBuffer}`,
          class: 'docx-embedded-image'
        };
      });
    })
  };

  try {
    const result = await mammoth.convertToHtml(options);
    return {
      html: result.value || '<p class="text-slate-500 italic">This document is empty.</p>',
      messages: (result.messages || []).map((m) => m.message)
    };
  } catch (err: any) {
    const msg = err?.message || '';
    if (
      msg.includes("Can't find end of central directory") ||
      msg.includes("is this a zip file") ||
      msg.includes("End of data reached")
    ) {
      throw new Error("LEGACY_DOC_NON_ZIP: File is not a ZIP archive. It may be a legacy Word (.doc) format.");
    }
    throw err;
  }
}
