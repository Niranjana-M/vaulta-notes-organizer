// In tsx / Node ESM environments, globalThis.__dirname can inadvertently be defined as '.'
// which breaks packages like vite-plugin-pwa that check `typeof __dirname !== 'undefined'`.
if (typeof (globalThis as any).__dirname !== 'undefined') {
  delete (globalThis as any).__dirname;
}

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';

const PORT = 3000;
const SUPABASE_STORAGE_BUCKET = 'vaulta-files';

// ----------------------------------------------------
// Normalize Supabase URL & Key from Environment
// ----------------------------------------------------
function getNormalizedSupabaseConfig() {
  const rawUrl = process.env.VITE_SUPABASE_URL || '';
  let url = 'https://kqgawuyrbyzsimawxrtc.supabase.co';

  if (rawUrl) {
    const urlMatch = rawUrl.match(/https?:\/\/[^\s"'\s<>]+/i);
    if (urlMatch) {
      url = urlMatch[0];
    } else {
      let cleaned = rawUrl.replace(/^(?:url|supabase_url|project_url)[:\s=_-]+/i, '').trim();
      if (/^[a-z0-9-]+$/i.test(cleaned)) {
        url = `https://${cleaned}.supabase.co`;
      } else if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
        url = cleaned;
      }
    }
  }

  const rawKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
  const key = rawKey
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^(?:key|anon_key|publishable_key)[:\s=_-]+/i, '')
    .trim();

  return { url, key };
}

const { url: SUPABASE_URL, key: SUPABASE_KEY } = getNormalizedSupabaseConfig();

function isSupabaseConfigured(): boolean {
  if (!SUPABASE_KEY || SUPABASE_KEY.length < 20 || SUPABASE_KEY === 'dummy_token_fallback') {
    return false;
  }
  if (!SUPABASE_URL || SUPABASE_URL.includes('kqgawuyrbyzsimawxrtc')) {
    return false;
  }
  return true;
}

let supabaseServer: SupabaseClient | null = null;
function getServerSupabase(): SupabaseClient {
  if (!supabaseServer) {
    supabaseServer = createClient(
      SUPABASE_URL,
      SUPABASE_KEY || 'dummy_token_fallback',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      }
    );
  }
  return supabaseServer;
}

// ----------------------------------------------------
// Initialize Firebase for Server
// ----------------------------------------------------
function getServerFirestore() {
  if (getApps().length === 0) {
    let firebaseConfig: any = {};
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      try {
        firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (e) {
        // Ignore parsing error
      }
    }
    if (!firebaseConfig.apiKey && process.env.VITE_FIREBASE_API_KEY) {
      firebaseConfig.apiKey = process.env.VITE_FIREBASE_API_KEY;
      firebaseConfig.projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'vaulta1-34f24';
    }
    initializeApp(firebaseConfig);
  }
  return getFirestore();
}

// In-memory cache for shared files (fallback when Supabase Storage is private or offline)
interface CachedShareFile {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  createdAt: number;
}
const shareFileCache = new Map<string, CachedShareFile>();

// Helper to determine MIME type
function getMimeType(fileName: string, rawMime?: string): string {
  if (rawMime && rawMime.includes('/')) return rawMime;
  const lower = (fileName || '').toLowerCase();
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

async function startServer() {
  const app = express();

  // ----------------------------------------------------
  // Health endpoint
  // ----------------------------------------------------
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // ----------------------------------------------------
  // Cache upload endpoint for share creation
  // Allows the owner to sync the file bytes when generating a share link
  // ----------------------------------------------------
  app.post(
    '/api/share-cache/:shareId',
    express.raw({ type: '*/*', limit: '50mb' }),
    (req: Request, res: Response) => {
      const shareId = req.params.shareId;
      if (!shareId || !Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: 'Valid shareId and non-empty body required' });
        return;
      }
      const rawFileName = (req.query.fileName as string) || 'document.docx';
      const rawMime = (req.query.mimeType as string) || getMimeType(rawFileName);

      shareFileCache.set(shareId, {
        buffer: req.body,
        mimeType: rawMime,
        fileName: rawFileName,
        createdAt: Date.now()
      });

      res.json({ success: true, size: req.body.length });
    }
  );

  // ----------------------------------------------------
  // Public Shared File Retrieval Endpoint:
  // GET /api/shared-file/:shareId
  //
  // 1. Verifies that the share link exists and is enabled in Firestore.
  // 2. Resolves the original storage path from the resource document.
  // 3. Retrieves the file from Supabase Storage (using signed URL or download).
  // 4. Returns the raw file bytes with appropriate content-type headers.
  // ----------------------------------------------------
  app.get('/api/shared-file/:shareId', async (req: Request, res: Response) => {
    const shareId = req.params.shareId?.trim();
    if (!shareId) {
      res.status(400).json({ error: 'Share ID is required.' });
      return;
    }

    try {
      const db = getServerFirestore();

      // 1. Check if the resource is shared in the resources collection
      let resourceData: any = null;
      let isEnabled = false;

      // Primary check: query resources collection with isShared == true
      const q = query(
        collection(db, 'resources'),
        where('shareId', '==', shareId),
        where('isShared', '==', true)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        resourceData = snap.docs[0].data();
        isEnabled = resourceData.isShared !== false && resourceData.shareEnabled !== false;
      }

      // Secondary check: look up in shares collection
      if (!resourceData) {
        try {
          const shareDoc = await getDoc(doc(db, 'shares', shareId));
          if (shareDoc.exists()) {
            const shareData = shareDoc.data();
            isEnabled = shareData.enabled !== false;
            if (shareData.resourceId) {
              const resDoc = await getDoc(doc(db, 'resources', shareData.resourceId));
              if (resDoc.exists()) {
                resourceData = resDoc.data();
                isEnabled = isEnabled && resourceData.isShared !== false && resourceData.shareEnabled !== false;
              }
            }
            if (!resourceData && shareData.resource) {
              resourceData = shareData.resource;
            }
          }
        } catch {
          // Ignore lookup error
        }
      }

      // If share record is disabled or not found, forbid access
      if (!isEnabled || !resourceData) {
        res.status(404).json({
          error: 'Shared resource not found or link has been disabled.',
          disabled: true
        });
        return;
      }

      const fileName = resourceData.fileName || resourceData.title || 'document';
      const mimeType = getMimeType(fileName, resourceData.mimeType);

      // Clean storage path
      let cleanStoragePath = (resourceData.storagePath || '')
        .replace(/^vaulta-files\//, '')
        .replace(/^local:\/\//, '')
        .replace(/^\/+/, '');

      if (!cleanStoragePath && resourceData.fileUrl?.includes('vaulta-files/')) {
        const parts = resourceData.fileUrl.split('vaulta-files/');
        if (parts[1]) {
          cleanStoragePath = parts[1].split('?')[0];
        }
      }

      let fileBuffer: Buffer | null = null;

      // Strategy 0: Check in-memory share cache (fastest and handles offline/local storage files)
      if (shareFileCache.has(shareId)) {
        const cached = shareFileCache.get(shareId)!;
        fileBuffer = cached.buffer;
      }

      // Strategy 1: Base64 Data URL decoding
      if (!fileBuffer) {
        const dataUrlCandidate =
          resourceData.fileUrl?.startsWith('data:') ? resourceData.fileUrl :
          resourceData.dataUrl?.startsWith('data:') ? resourceData.dataUrl : null;
        if (dataUrlCandidate) {
          try {
            const base64Part = dataUrlCandidate.split(',')[1];
            if (base64Part) {
              fileBuffer = Buffer.from(base64Part, 'base64');
            }
          } catch {
            // Ignore decoding failure
          }
        }
      }

      // Strategy 2: Direct URL fetch if standard HTTP/HTTPS (excluding placeholder domains)
      if (!fileBuffer && resourceData.fileUrl && (resourceData.fileUrl.startsWith('http://') || resourceData.fileUrl.startsWith('https://'))) {
        const isPlaceholder = resourceData.fileUrl.includes('kqgawuyrbyzsimawxrtc');
        if (!isPlaceholder) {
          try {
            const fetchRes = await fetch(resourceData.fileUrl);
            if (fetchRes.ok) {
              const ab = await fetchRes.arrayBuffer();
              if (ab.byteLength > 50) {
                fileBuffer = Buffer.from(ab);
              }
            }
          } catch {
            // Ignore fetch failure
          }
        }
      }

      // Strategy 3: Supabase Storage (Only attempted when configured with valid keys and not marked local)
      const isLocal =
        resourceData.storagePath?.startsWith('local://') ||
        resourceData.fileUrl?.startsWith('local://');

      if (!fileBuffer && isSupabaseConfigured() && !isLocal && cleanStoragePath) {
        const supabase = getServerSupabase();

        // 3a. Supabase signed URL download
        try {
          const { data: signedData, error: signedErr } = await supabase.storage
            .from(SUPABASE_STORAGE_BUCKET)
            .createSignedUrl(cleanStoragePath, 3600);

          if (!signedErr && signedData?.signedUrl) {
            const fetchRes = await fetch(signedData.signedUrl);
            if (fetchRes.ok) {
              const ab = await fetchRes.arrayBuffer();
              if (ab.byteLength > 50) {
                fileBuffer = Buffer.from(ab);
              }
            }
          }
        } catch {
          // Ignore signed url fallback
        }

        // 3b. Direct Supabase SDK download
        if (!fileBuffer) {
          try {
            const { data, error } = await supabase.storage
              .from(SUPABASE_STORAGE_BUCKET)
              .download(cleanStoragePath);

            if (!error && data) {
              const ab = await data.arrayBuffer();
              if (ab.byteLength > 50) {
                fileBuffer = Buffer.from(ab);
              }
            }
          } catch {
            // Ignore SDK download fallback
          }
        }

        // 3c. Public URL fetch with Supabase credentials
        if (!fileBuffer) {
          try {
            const { data: pubData } = supabase.storage
              .from(SUPABASE_STORAGE_BUCKET)
              .getPublicUrl(cleanStoragePath);

            if (pubData?.publicUrl) {
              const fetchRes = await fetch(pubData.publicUrl, {
                headers: {
                  apikey: SUPABASE_KEY,
                  Authorization: `Bearer ${SUPABASE_KEY}`
                }
              });
              if (fetchRes.ok) {
                const ab = await fetchRes.arrayBuffer();
                if (ab.byteLength > 50) {
                  fileBuffer = Buffer.from(ab);
                }
              }
            }
          } catch {
            // Ignore public url fallback
          }
        }
      }

      if (!fileBuffer) {
        res.status(502).json({
          error: 'Unable to retrieve file bytes from storage.',
          storagePath: cleanStoragePath
        });
        return;
      }

      // Send the file bytes with proper headers
      res.setHeader('Content-Type', mimeType);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(fileName)}"`
      );
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(fileBuffer);
    } catch (error: any) {
      console.log('[Server] /api/shared-file notice:', error?.message);
      res.status(500).json({ error: 'Internal server error retrieving file' });
    }
  });

  // ----------------------------------------------------
  // Vite Middleware Setup
  // ----------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Vaulta Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
