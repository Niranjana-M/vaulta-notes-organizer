import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StudyResource } from '../../types';
import {
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Maximize2,
  Columns,
  BookOpen,
  RefreshCw,
  ExternalLink,
  Expand,
  FileText
} from 'lucide-react';
import { formatFileSize, getFileFromLocalDB } from '../../services/storageService';
import { supabase, SUPABASE_STORAGE_BUCKET, isSupabaseConfigured } from '../../lib/supabase';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Initialize PDF.js worker
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  }
}

interface SharedPdfViewerProps {
  resource: StudyResource;
  shareId?: string;
  onDownload?: () => void;
  onOpenFullscreen?: () => void;
}

/**
 * Validates if the given buffer starts with standard PDF magic bytes (%PDF -> 0x25 0x50 0x44 0x46)
 */
function isPdfBuffer(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4) return false;
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46    // F
  );
}

/**
 * Resilient multi-strategy PDF byte retrieval for shared resources.
 * Works seamlessly without requiring the recipient to log in.
 */
async function retrievePdfBytes(
  resource: StudyResource,
  explicitShareId?: string
): Promise<{ data: Uint8Array; blob: Blob }> {
  const cleanFileName = resource.fileName || resource.title || 'document.pdf';

  // Strategy 0: Server-side proxy retrieval for shared files
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
        if (isPdfBuffer(buffer)) {
          const uint8Array = new Uint8Array(buffer);
          const blob = new Blob([uint8Array], { type: 'application/pdf' });
          return { data: uint8Array, blob };
        }
      }
    } catch (apiErr) {
      console.warn('[SharedPdfViewer] Server proxy shared PDF fetch notice:', apiErr);
    }
  }

  // Extract clean storage path if present
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

  // Strategy 1: Data URL or Blob URL (Immediate in-memory)
  if (
    resource.fileUrl &&
    (resource.fileUrl.startsWith('data:') || resource.fileUrl.startsWith('blob:'))
  ) {
    try {
      const response = await fetch(resource.fileUrl);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        if (isPdfBuffer(buffer)) {
          const uint8Array = new Uint8Array(buffer);
          const blob = new Blob([uint8Array], { type: 'application/pdf' });
          return { data: uint8Array, blob };
        }
      }
    } catch {
      // Ignore data URL error
    }
  }

  // Strategy 2: Direct public HTTP/HTTPS fetch from resource.fileUrl (excluding placeholder domains)
  if (
    resource.fileUrl &&
    (resource.fileUrl.startsWith('http://') || resource.fileUrl.startsWith('https://')) &&
    !resource.fileUrl.includes('kqgawuyrbyzsimawxrtc')
  ) {
    try {
      const response = await fetch(resource.fileUrl, {
        method: 'GET',
        mode: 'cors'
      });
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        if (isPdfBuffer(buffer)) {
          const uint8Array = new Uint8Array(buffer);
          const blob = new Blob([uint8Array], { type: 'application/pdf' });
          return { data: uint8Array, blob };
        }
      }
    } catch {
      // Ignore direct fetch error
    }
  }

  // Strategy 3: Supabase Storage (Only attempted when configured with valid keys and not marked local)
  const isLocal =
    resource.storagePath?.startsWith('local://') ||
    resource.fileUrl?.startsWith('local://');

  if (isSupabaseConfigured() && !isLocal && cleanStoragePath) {
    // 3a. Supabase Storage createSignedUrl
    try {
      const { data: signedData, error: signedErr } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .createSignedUrl(cleanStoragePath, 3600);

      if (!signedErr && signedData?.signedUrl) {
        const response = await fetch(signedData.signedUrl);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          if (isPdfBuffer(buffer)) {
            const uint8Array = new Uint8Array(buffer);
            const blob = new Blob([uint8Array], { type: 'application/pdf' });
            return { data: uint8Array, blob };
          }
        }
      }
    } catch {
      // Ignore signed URL error
    }

    // 3b. Derived Supabase Storage Public URL
    try {
      const { data: pubData } = supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .getPublicUrl(cleanStoragePath);

      if (pubData?.publicUrl && pubData.publicUrl !== resource.fileUrl) {
        const response = await fetch(pubData.publicUrl, {
          method: 'GET',
          mode: 'cors'
        });
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          if (isPdfBuffer(buffer)) {
            const uint8Array = new Uint8Array(buffer);
            const blob = new Blob([uint8Array], { type: 'application/pdf' });
            return { data: uint8Array, blob };
          }
        }
      }
    } catch {
      // Ignore public URL error
    }

    // 3c. Supabase Storage SDK download
    try {
      const { data, error } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .download(cleanStoragePath);

      if (!error && data) {
        const buffer = await data.arrayBuffer();
        if (isPdfBuffer(buffer)) {
          const uint8Array = new Uint8Array(buffer);
          return { data: uint8Array, blob: data };
        }
      }
    } catch {
      // Ignore SDK download error
    }
  }

  // Strategy 5: IndexedDB Local Storage fallback (if created on same device/browser)
  try {
    const candidatePath =
      cleanStoragePath ||
      (resource.storagePath || '').replace(/^local:\/\//, '') ||
      resource.fileUrl;
    const localDataUrl = await getFileFromLocalDB(candidatePath, cleanFileName);
    if (localDataUrl) {
      const response = await fetch(localDataUrl);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        if (isPdfBuffer(buffer)) {
          const uint8Array = new Uint8Array(buffer);
          const blob = new Blob([uint8Array], { type: 'application/pdf' });
          return { data: uint8Array, blob };
        }
      }
    }
  } catch (err) {
    console.warn('[SharedPdfViewer] IndexedDB local fallback notice:', err);
  }

  throw new Error('Unable to retrieve PDF file bytes from storage. Please verify connection or try downloading.');
}

export function SharedPdfViewer({
  resource,
  shareId,
  onDownload,
  onOpenFullscreen
}: SharedPdfViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'continuous' | 'single'>('continuous');
  const [loadedBlob, setLoadedBlob] = useState<Blob | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);
  const canvasRefs = useRef<{ [pageNumber: number]: HTMLCanvasElement | null }>({});
  const renderTasksRef = useRef<{ [pageNumber: number]: any }>({});
  const isCancelledRef = useRef(false);

  // Trigger download helper
  const handleDownload = () => {
    if (loadedBlob) {
      const blobUrl = URL.createObjectURL(loadedBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = resource.fileName || `${resource.title || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      return;
    }
    if (onDownload) {
      onDownload();
    }
  };

  // Load PDF Binary Bytes and initialize PDF.js
  const loadPdf = useCallback(async () => {
    setLoading(true);
    setError(null);
    isCancelledRef.current = false;

    try {
      const { data: pdfBytes, blob } = await retrievePdfBytes(resource, shareId);
      if (isCancelledRef.current) return;

      setLoadedBlob(blob);

      // Load into PDF.js
      const loadingTask = pdfjsLib.getDocument({
        data: pdfBytes,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/cmaps/',
        cMapPacked: true
      });

      const pdf = await loadingTask.promise;
      if (isCancelledRef.current) return;

      pdfDocRef.current = pdf;
      setNumPages(pdf.numPages);
      setCurrentPage(1);

      // Calculate initial responsive fit-to-width scale
      try {
        const firstPage = await pdf.getPage(1);
        const unscaledViewport = firstPage.getViewport({ scale: 1.0, rotation: 0 });
        if (containerRef.current && unscaledViewport.width > 0) {
          const containerWidth = containerRef.current.clientWidth - 48; // padding
          const fitScale = Math.min(1.6, Math.max(0.45, containerWidth / unscaledViewport.width));
          setScale(+fitScale.toFixed(2));
        } else {
          setScale(1.0);
        }
      } catch (scaleErr) {
        setScale(1.0);
      }

      setLoading(false);
    } catch (err: any) {
      if (isCancelledRef.current) return;
      console.error('[SharedPdfViewer] Failed to load PDF:', err);
      setError(err?.message || 'Failed to render PDF document.');
      setLoading(false);
    }
  }, [resource, shareId]);

  useEffect(() => {
    loadPdf();

    return () => {
      isCancelledRef.current = true;
      // Cancel any running page renders
      Object.values(renderTasksRef.current).forEach((task) => {
        try {
          task?.cancel();
        } catch (e) {
          // ignore
        }
      });
      renderTasksRef.current = {};
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch (e) {
          // ignore
        }
        pdfDocRef.current = null;
      }
    };
  }, [loadPdf]);

  // Render a specific page onto its canvas with High-DPI support and cancellation
  const renderPage = useCallback(
    async (pageNum: number) => {
      const pdf = pdfDocRef.current;
      if (!pdf) return;

      const canvas = canvasRefs.current[pageNum];
      if (!canvas) return;

      // Cancel previous in-flight render task on this canvas
      if (renderTasksRef.current[pageNum]) {
        try {
          renderTasksRef.current[pageNum].cancel();
        } catch (e) {
          // ignore
        }
        delete renderTasksRef.current[pageNum];
      }

      try {
        const page = await pdf.getPage(pageNum);
        if (isCancelledRef.current) return;

        const viewport = page.getViewport({ scale, rotation });
        const pixelRatio = Math.max(window.devicePixelRatio || 1, 1.5);

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;

        // Opaque white canvas background for clean document paper presentation
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.save();
        context.scale(pixelRatio, pixelRatio);

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        const renderTask = page.render(renderContext);
        renderTasksRef.current[pageNum] = renderTask;

        await renderTask.promise;
      } catch (renderErr: any) {
        if (renderErr?.name !== 'RenderingCancelledException') {
          console.warn(`[SharedPdfViewer] Render error on page ${pageNum}:`, renderErr);
        }
      } finally {
        if (renderTasksRef.current[pageNum]) {
          delete renderTasksRef.current[pageNum];
        }
      }
    },
    [scale, rotation]
  );

  // Trigger page rendering when scale, rotation, viewMode, or currentPage changes
  useEffect(() => {
    if (!pdfDocRef.current || numPages === 0 || loading || error) return;

    if (viewMode === 'continuous') {
      for (let i = 1; i <= numPages; i++) {
        renderPage(i);
      }
    } else {
      renderPage(currentPage);
    }
  }, [scale, rotation, viewMode, currentPage, numPages, loading, error, renderPage]);

  // Zoom and layout handlers
  const handleZoomIn = () => setScale((prev) => Math.min(2.8, +(prev + 0.15).toFixed(2)));
  const handleZoomOut = () => setScale((prev) => Math.max(0.4, +(prev - 0.15).toFixed(2)));
  const handleResetZoom = () => setScale(1.0);
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleFitToWidth = () => {
    if (containerRef.current && pdfDocRef.current) {
      const containerWidth = containerRef.current.clientWidth - 48;
      pdfDocRef.current.getPage(1).then((page: any) => {
        const unscaledViewport = page.getViewport({ scale: 1.0, rotation });
        if (unscaledViewport.width > 0) {
          const newScale = Math.min(2.4, Math.max(0.45, containerWidth / unscaledViewport.width));
          setScale(+newScale.toFixed(2));
        }
      });
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {
        if (onOpenFullscreen) onOpenFullscreen();
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Keyboard shortcut listener when viewer is active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (viewMode === 'single') {
          setCurrentPage((p) => Math.min(numPages, p + 1));
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (viewMode === 'single') {
          setCurrentPage((p) => Math.max(1, p - 1));
        }
      } else if (e.key === '=' || e.key === '+') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages, viewMode]);

  return (
    <div
      id="shared-pdf-viewer-root"
      ref={containerRef}
      className={`w-full flex flex-col rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 shadow-inner transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none' : 'my-4'
      }`}
    >
      {/* Viewer Controls Toolbar */}
      <div
        id="shared-pdf-toolbar"
        className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shrink-0 select-none shadow-xs"
      >
        {/* Left: Page Navigation & Counter */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {viewMode === 'single' ? (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                id="shared-pdf-prev-page-btn"
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loading}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition cursor-pointer text-slate-700 dark:text-slate-200"
                title="Previous Page"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold px-1.5 text-slate-800 dark:text-slate-100">
                {currentPage} / {numPages || 1}
              </span>
              <button
                id="shared-pdf-next-page-btn"
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                disabled={currentPage >= numPages || loading}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition cursor-pointer text-slate-700 dark:text-slate-200"
                title="Next Page"
                aria-label="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300">
              <BookOpen className="w-3.5 h-3.5 text-rose-500" />
              <span>
                {numPages > 0 ? `${numPages} ${numPages === 1 ? 'page' : 'pages'}` : 'Document'}
              </span>
            </div>
          )}

          {/* View mode toggle button */}
          {numPages > 1 && (
            <button
              id="shared-pdf-viewmode-btn"
              type="button"
              onClick={() => setViewMode((m) => (m === 'continuous' ? 'single' : 'continuous'))}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              title={viewMode === 'continuous' ? 'Switch to Single Page' : 'Switch to Continuous Scroll'}
            >
              <Columns className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline capitalize">{viewMode}</span>
            </button>
          )}
        </div>

        {/* Center: Zoom and Display Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            id="shared-pdf-zoom-out-btn"
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.45 || loading}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition cursor-pointer text-slate-600 dark:text-slate-300"
            title="Zoom Out (-)"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            id="shared-pdf-reset-zoom-btn"
            type="button"
            onClick={handleResetZoom}
            className="px-2 py-1 text-xs font-mono font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-slate-700 dark:text-slate-200"
            title="Reset Zoom to 100%"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            id="shared-pdf-zoom-in-btn"
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 2.8 || loading}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition cursor-pointer text-slate-600 dark:text-slate-300"
            title="Zoom In (+)"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-0.5 hidden sm:block" />

          <button
            id="shared-pdf-fit-width-btn"
            type="button"
            onClick={handleFitToWidth}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-slate-600 dark:text-slate-300 hidden sm:inline-flex"
            title="Fit to Width"
            aria-label="Fit to Width"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <button
            id="shared-pdf-rotate-btn"
            type="button"
            onClick={handleRotate}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-slate-600 dark:text-slate-300 hidden sm:inline-flex"
            title="Rotate 90°"
            aria-label="Rotate"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Fullscreen & Quick Download */}
        <div className="flex items-center gap-1.5">
          <button
            id="shared-pdf-fullscreen-btn"
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Reading Mode'}
            aria-label="Toggle Fullscreen"
          >
            <Expand className="w-4 h-4" />
          </button>

          <button
            id="shared-pdf-toolbar-download-btn"
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            title="Download PDF Document"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download PDF</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Document Scroll Area */}
      <div
        id="shared-pdf-scroll-viewport"
        className="w-full min-h-[460px] max-h-[82vh] overflow-y-auto overflow-x-auto p-4 sm:p-6 flex flex-col items-center justify-start relative bg-slate-200/60 dark:bg-slate-950/80 select-text"
      >
        {/* Loading Indicator */}
        {loading && (
          <div
            id="shared-pdf-loading-state"
            className="flex flex-col items-center justify-center my-auto py-16 gap-3 text-center"
          >
            <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800">
              <Loader2 className="w-8 h-8 text-rose-600 dark:text-rose-500 animate-spin" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Rendering PDF Document...
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
              Loading document pages and vector typography with high fidelity
            </p>
          </div>
        )}

        {/* Error Fallback with Retry & Direct Download */}
        {!loading && error && (
          <div
            id="shared-pdf-error-state"
            className="flex flex-col items-center justify-center my-auto py-12 px-6 max-w-md text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl space-y-4"
          >
            <div className="p-3 bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 rounded-xl">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Unable to render PDF preview
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {error}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => loadPdf()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Loading</span>
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF File</span>
              </button>
            </div>
          </div>
        )}

        {/* Rendered PDF Pages via Canvas */}
        {!loading && !error && numPages > 0 && (
          <div
            id="shared-pdf-pages-container"
            className="flex flex-col items-center gap-6 w-full max-w-full"
          >
            {viewMode === 'continuous' ? (
              Array.from({ length: numPages }, (_, index) => {
                const pageNumber = index + 1;
                return (
                  <div
                    key={`page-${pageNumber}`}
                    id={`shared-pdf-page-${pageNumber}`}
                    className="flex flex-col items-center relative group"
                  >
                    {/* Paper Container */}
                    <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-slate-300/80 dark:border-slate-700/80 transition-shadow duration-200 hover:shadow-xl">
                      <canvas
                        ref={(el) => {
                          canvasRefs.current[pageNumber] = el;
                        }}
                        className="block max-w-full"
                      />
                    </div>

                    {/* Page Number Pill */}
                    <div className="mt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 px-2.5 py-0.5 rounded-full shadow-2xs">
                      Page {pageNumber} of {numPages}
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                id={`shared-pdf-single-page-${currentPage}`}
                className="flex flex-col items-center relative"
              >
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-slate-300/80 dark:border-slate-700/80">
                  <canvas
                    ref={(el) => {
                      canvasRefs.current[currentPage] = el;
                    }}
                    className="block max-w-full"
                  />
                </div>
                <div className="mt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 px-2.5 py-0.5 rounded-full shadow-2xs">
                  Page {currentPage} of {numPages}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info Bar */}
      <div
        id="shared-pdf-footer-bar"
        className="px-4 py-2 bg-white/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2 shrink-0 select-none"
      >
        <span className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-rose-500" />
          <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[240px]">
            {resource.fileName || resource.title}
          </span>
          {resource.fileSize && (
            <span>• {formatFileSize(resource.fileSize)}</span>
          )}
        </span>
        <span className="text-[10px] text-slate-400">
          Scroll to read all pages • Use zoom controls for closer inspection
        </span>
      </div>
    </div>
  );
}
