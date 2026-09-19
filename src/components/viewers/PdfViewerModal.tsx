import React, { useState, useEffect, useRef } from 'react';
import { StudyResource } from '../../types';
import {
  X,
  ExternalLink,
  Download,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Maximize2,
  Columns
} from 'lucide-react';
import { formatFileSize, getFileFromLocalDB } from '../../services/storageService';
import { supabase, SUPABASE_STORAGE_BUCKET } from '../../lib/supabase';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PdfViewerModalProps {
  resource: StudyResource | null;
  onClose: () => void;
  pdfBlob?: Blob;
}

export function PdfViewerModal({ resource, onClose, pdfBlob }: PdfViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [rotation, setRotation] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'continuous' | 'single'>('continuous');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [useNativeViewer, setUseNativeViewer] = useState(false);

  const pdfDocRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<{ [page: number]: HTMLCanvasElement | null }>({});

  // Clean up blob URL on unmount (only if created internally, not if supplied by resource)
  useEffect(() => {
    return () => {
      if (blobUrl && blobUrl.startsWith('blob:') && blobUrl !== resource?.fileUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl, resource?.fileUrl]);

  // Load PDF Binary Data from Supabase / Local Storage / URL
  useEffect(() => {
    let isCancelled = false;

    async function loadPdfData() {
      if (!resource) return;
      setLoading(true);
      setError(null);

      try {
        let pdfData: ArrayBuffer | Uint8Array | string | null = null;
        let createdBlobUrl: string | null = null;

        // Check for direct Blob passed in props or attached to resource (e.g. from File Converter)
        const directBlob = pdfBlob || (resource as any)?.blob;
        if (directBlob instanceof Blob) {
          try {
            const arrayBuffer = await directBlob.arrayBuffer();
            pdfData = new Uint8Array(arrayBuffer);
            createdBlobUrl = resource.fileUrl || URL.createObjectURL(directBlob);
          } catch (blobReadErr) {
            console.warn('Direct blob read notice:', blobReadErr);
          }
        }

        // Case 1: Data URL or Blob URL (read array buffer on main thread to pass directly to PDF.js)
        if (!pdfData && (resource.fileUrl?.startsWith('data:') || resource.fileUrl?.startsWith('blob:'))) {
          try {
            const response = await fetch(resource.fileUrl);
            const arrayBuffer = await response.arrayBuffer();
            pdfData = new Uint8Array(arrayBuffer);
            createdBlobUrl = resource.fileUrl;
          } catch (fetchErr) {
            console.warn('Could not read blob/data URL as arrayBuffer, trying direct URL:', fetchErr);
            pdfData = resource.fileUrl;
            createdBlobUrl = resource.fileUrl;
          }
        }
        // Case 2: Local Storage / IndexedDB
        else if (!pdfData && resource.storagePath?.startsWith('local://')) {
          const cleanPath = resource.storagePath.replace('local://', '');
          const localDataUrl = await getFileFromLocalDB(cleanPath);
          if (localDataUrl) {
            pdfData = localDataUrl;
            createdBlobUrl = localDataUrl;
          }
        }
        // Case 3: Supabase Storage direct download
        else if (!pdfData && resource.storagePath && !resource.storagePath.startsWith('local://')) {
          const cleanStoragePath = resource.storagePath.startsWith('vaulta-files/')
            ? resource.storagePath.replace('vaulta-files/', '')
            : resource.storagePath;

          try {
            const { data, error: downloadError } = await supabase.storage
              .from(SUPABASE_STORAGE_BUCKET)
              .download(cleanStoragePath);

            if (!downloadError && data) {
              const arrayBuffer = await data.arrayBuffer();
              pdfData = new Uint8Array(arrayBuffer);
              createdBlobUrl = URL.createObjectURL(data);
            }
          } catch (storageErr) {
            console.warn('Supabase SDK direct download fallback to URL fetch:', storageErr);
          }
        }

        // Case 4: Fallback to direct HTTP fetch from fileUrl
        if (!pdfData && resource.fileUrl) {
          try {
            const response = await fetch(resource.fileUrl);
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            pdfData = new Uint8Array(arrayBuffer);
            createdBlobUrl = URL.createObjectURL(blob);
          } catch (fetchErr: any) {
            console.warn('Direct fetch notice, trying URL directly in PDF.js:', fetchErr);
            pdfData = resource.fileUrl;
            createdBlobUrl = resource.fileUrl;
          }
        }

        if (isCancelled) return;

        if (!pdfData && !createdBlobUrl) {
          throw new Error('Unable to retrieve PDF data from Supabase Storage.');
        }

        if (createdBlobUrl) {
          setBlobUrl(createdBlobUrl);
        }

        // Attempt to load document into PDF.js
        try {
          const loadingTask = pdfjsLib.getDocument(
            typeof pdfData === 'string' ? { url: pdfData } : { data: pdfData! }
          );

          const pdf = await loadingTask.promise;
          if (isCancelled) return;

          pdfDocRef.current = pdf;
          setNumPages(pdf.numPages);
          setCurrentPage(1);
          setLoading(false);
        } catch (pdfjsErr: any) {
          console.warn('PDF.js engine notice, falling back to native viewer:', pdfjsErr);
          if (createdBlobUrl || resource.fileUrl) {
            setUseNativeViewer(true);
            setLoading(false);
          } else {
            throw pdfjsErr;
          }
        }
      } catch (err: any) {
        if (isCancelled) return;
        console.error('PDF loading error:', err);
        setError(err.message || 'Failed to open PDF document.');
        setLoading(false);
      }
    }

    loadPdfData();

    return () => {
      isCancelled = true;
    };
  }, [resource, pdfBlob]);

  // Render a specific page onto its canvas
  const renderPage = async (pageNum: number) => {
    const pdf = pdfDocRef.current;
    if (!pdf) return;

    try {
      const page = await pdf.getPage(pageNum);
      const canvas = canvasRefs.current[pageNum];
      if (!canvas) return;

      const viewport = page.getViewport({ scale, rotation });
      const context = canvas.getContext('2d');
      if (!context) return;

      // Support High-DPI screens for crisp typography
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
    } catch (renderErr) {
      console.warn(`Render error on page ${pageNum}:`, renderErr);
    }
  };

  // Re-render pages when scale, rotation, viewMode, or currentPage changes
  useEffect(() => {
    if (!pdfDocRef.current || numPages === 0 || loading) return;

    if (viewMode === 'continuous') {
      for (let i = 1; i <= numPages; i++) {
        renderPage(i);
      }
    } else {
      renderPage(currentPage);
    }
  }, [scale, rotation, viewMode, currentPage, numPages, loading]);

  // Keyboard shortcut listener for Esc, Arrow keys, + and -
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (viewMode === 'single') {
          setCurrentPage((prev) => Math.min(numPages, prev + 1));
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (viewMode === 'single') {
          setCurrentPage((prev) => Math.max(1, prev - 1));
        }
      } else if (e.key === '=' || e.key === '+') {
        setScale((prev) => Math.min(3.0, +(prev + 0.15).toFixed(2)));
      } else if (e.key === '-') {
        setScale((prev) => Math.max(0.5, +(prev - 0.15).toFixed(2)));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages, viewMode, onClose]);

  const handleZoomIn = () => setScale((prev) => Math.min(3.0, +(prev + 0.2).toFixed(2)));
  const handleZoomOut = () => setScale((prev) => Math.max(0.5, +(prev - 0.2).toFixed(2)));
  const handleResetZoom = () => setScale(1.2);
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleFitToWidth = () => {
    if (containerRef.current && pdfDocRef.current) {
      const containerWidth = containerRef.current.clientWidth - 48; // padding
      pdfDocRef.current.getPage(1).then((page: any) => {
        const unscaledViewport = page.getViewport({ scale: 1.0, rotation });
        if (unscaledViewport.width > 0) {
          const newScale = Math.min(2.5, Math.max(0.5, containerWidth / unscaledViewport.width));
          setScale(+newScale.toFixed(2));
        }
      });
    }
  };

  if (!resource) return null;

  const downloadTargetUrl = blobUrl || resource.fileUrl;
  const fileName = resource.fileName || `${resource.title}.pdf`;

  return (
    <div
      id="pdf-viewer-modal-overlay"
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm text-slate-100 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      {/* Top Navigation & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between px-3 sm:px-4 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0 gap-2 select-none shadow-sm">
        {/* Title and Metadata */}
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <div className="p-2 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-400 shrink-0 shadow-inner">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-[180px] sm:max-w-xs md:max-w-md">
              {resource.title}
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="truncate max-w-[120px] text-slate-300 font-medium">
                {resource.subjectName}
              </span>
              {resource.fileSize && (
                <>
                  <span>•</span>
                  <span>{formatFileSize(resource.fileSize)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center Viewer Controls (Zoom, Navigation, View Mode) */}
        {!loading && !error && numPages > 0 && (
          <div className="flex items-center gap-1 sm:gap-2 bg-slate-950/70 border border-slate-800 px-2 py-1 rounded-xl">
            {/* Page Navigator */}
            {viewMode === 'single' ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono px-1 text-slate-300">
                  {currentPage} / {numPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                  disabled={currentPage >= numPages}
                  className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <span className="text-xs font-mono px-2 text-slate-400 hidden sm:inline">
                {numPages} {numPages === 1 ? 'page' : 'pages'}
              </span>
            )}

            <div className="h-4 w-px bg-slate-800 hidden sm:block" />

            {/* Zoom Controls */}
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="text-xs font-mono text-slate-300 hover:text-indigo-400 px-1 hover:bg-slate-800 rounded transition"
              title="Reset Zoom"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleFitToWidth}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition hidden sm:inline-flex"
              title="Fit to Width"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleRotate}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition hidden md:inline-flex"
              title="Rotate 90°"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-800 hidden md:block" />

            {/* View Mode Toggle */}
            <button
              type="button"
              onClick={() => setViewMode((m) => (m === 'continuous' ? 'single' : 'continuous'))}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition hidden md:inline-flex items-center gap-1 text-xs"
              title={viewMode === 'continuous' ? 'Switch to Single Page' : 'Switch to Continuous Scroll'}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="text-[11px] capitalize">{viewMode}</span>
            </button>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {downloadTargetUrl && (
            <button
              type="button"
              onClick={() => setUseNativeViewer((v) => !v)}
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
              title="Toggle between Canvas and Native Browser Viewer"
            >
              <span>{useNativeViewer ? 'Canvas Mode' : 'Native Mode'}</span>
            </button>
          )}
          <a
            id="pdf-open-newtab-link"
            href={downloadTargetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in Tab</span>
          </a>
          <a
            id="pdf-download-btn"
            href={downloadTargetUrl}
            download={fileName}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition shadow"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </a>
          <button
            id="pdf-viewer-close-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer"
            aria-label="Close viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main PDF Rendering Container */}
      <div
        ref={containerRef}
        id="pdf-canvas-scroll-container"
        className="flex-1 w-full h-full bg-slate-950 overflow-auto relative flex flex-col items-center p-4 sm:p-6"
      >
        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center my-auto py-16 gap-3">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-300">Retrieving & rendering PDF document...</p>
            <p className="text-xs text-slate-500">Loading document...</p>
          </div>
        )}

        {/* Native Iframe Viewer Mode */}
        {!loading && useNativeViewer && downloadTargetUrl && (
          <div className="w-full h-full flex-1 flex flex-col items-center max-w-5xl mx-auto pb-4">
            <iframe
              id="pdf-native-frame"
              src={downloadTargetUrl}
              title={resource.title}
              className="w-full h-full min-h-[600px] flex-1 rounded-xl border border-slate-800 bg-white shadow-2xl"
            />
          </div>
        )}

        {/* Error Fallback (with native embed fallback if URL exists) */}
        {!loading && error && (
          downloadTargetUrl ? (
            <div className="w-full h-full flex-1 flex flex-col items-center max-w-5xl mx-auto pb-4">
              <div className="mb-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-xs text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Rendered via browser engine</span>
              </div>
              <iframe
                id="pdf-native-fallback-frame"
                src={downloadTargetUrl}
                title={resource.title}
                className="w-full h-full min-h-[600px] flex-1 rounded-xl border border-slate-800 bg-white shadow-2xl"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center my-auto py-16 max-w-md text-center p-6 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl">
              <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-400 rounded-xl mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">Unable to preview this PDF. Please try downloading it.</h3>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">{error}</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href={downloadTargetUrl}
                  download={fileName}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition shadow flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File</span>
                </a>
                <a
                  href={downloadTargetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in Tab</span>
                </a>
              </div>
            </div>
          )
        )}

        {/* Rendered PDF Pages (Canvas Mode) */}
        {!loading && !error && !useNativeViewer && numPages > 0 && (
          <div className="flex flex-col items-center gap-6 w-full max-w-full pb-8">
            {viewMode === 'continuous' ? (
              Array.from({ length: numPages }, (_, index) => {
                const pageNumber = index + 1;
                return (
                  <div
                    key={pageNumber}
                    className="flex flex-col items-center relative group"
                  >
                    <div className="shadow-2xl rounded-sm overflow-hidden bg-white ring-1 ring-slate-800">
                      <canvas
                        ref={(el) => {
                          canvasRefs.current[pageNumber] = el;
                        }}
                        className="block max-w-full"
                      />
                    </div>
                    <div className="mt-2 text-[11px] font-mono text-slate-400 bg-slate-900/80 border border-slate-800 px-2 py-0.5 rounded-full">
                      Page {pageNumber} of {numPages}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center">
                <div className="shadow-2xl rounded-sm overflow-hidden bg-white ring-1 ring-slate-800">
                  <canvas
                    ref={(el) => {
                      canvasRefs.current[currentPage] = el;
                    }}
                    className="block max-w-full"
                  />
                </div>
                <div className="mt-2 text-[11px] font-mono text-slate-400 bg-slate-900/80 border border-slate-800 px-2 py-0.5 rounded-full">
                  Page {currentPage} of {numPages}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Footer helper */}
      <div className="sm:hidden px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300 shrink-0">
        <span>{numPages > 0 ? `${numPages} pages` : 'PDF Document'}</span>
        <a
          href={downloadTargetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 font-semibold underline flex items-center gap-1"
        >
          <span>Open Fullscreen</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

