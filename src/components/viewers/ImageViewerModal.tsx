import React, { useState, useEffect, useRef } from 'react';
import { StudyResource } from '../../types';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { formatFileSize, downloadResourceFile, retrieveImageBlob } from '../../services/storageService';

interface ImageViewerModalProps {
  resource: StudyResource | null;
  onClose: () => void;
  shareId?: string;
}

export function ImageViewerModal({ resource, onClose, shareId }: ImageViewerModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [reloadKey, setReloadKey] = useState<number>(0);

  // Keep track of the active blob URL for cleanup
  const activeBlobUrlRef = useRef<string | null>(null);

  // Revoke previous blob URL when it changes or on unmount
  useEffect(() => {
    return () => {
      if (activeBlobUrlRef.current && activeBlobUrlRef.current.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(activeBlobUrlRef.current);
        } catch (e) {
          console.warn('[ImageViewerModal] Error revoking blob URL on unmount:', e);
        }
        activeBlobUrlRef.current = null;
      }
    };
  }, []);

  // Fetch and prepare image as a clean Blob object URL
  useEffect(() => {
    if (!resource) return;

    let isCancelled = false;

    async function loadImageBlob() {
      if (!resource) return;

      setLoading(true);
      setError(null);

      // Clean up previous blob URL before creating a new one
      if (activeBlobUrlRef.current && activeBlobUrlRef.current.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(activeBlobUrlRef.current);
        } catch (e) {
          console.warn('[ImageViewerModal] Error revoking previous blob URL:', e);
        }
        activeBlobUrlRef.current = null;
        setBlobUrl(null);
      }

      try {
        // Retrieve the image as a Blob using the unified storage logic
        const imageBlob = await retrieveImageBlob(resource, shareId);

        // Check cancellation
        if (isCancelled) return;

        if (!imageBlob || imageBlob.size === 0) {
          throw new Error('Unable to load image file from storage.');
        }

        // Create temporary object URL from verified Blob
        const newObjectUrl = URL.createObjectURL(imageBlob);
        activeBlobUrlRef.current = newObjectUrl;
        setBlobUrl(newObjectUrl);
        setLoading(false);
      } catch (err: any) {
        if (isCancelled) return;
        console.error('[ImageViewerModal] Failed to prepare image Blob:', err);
        setError(err.message || 'Unable to load image file from storage.');
        setLoading(false);
      }
    }

    loadImageBlob();

    return () => {
      isCancelled = true;
    };
  }, [resource, shareId, reloadKey]);

  if (!resource) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.25));
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleDownload = async () => {
    if (!resource || downloading) return;
    setDownloading(true);
    try {
      const detectedShareId =
        shareId ||
        (resource as any).shareId ||
        (typeof window !== 'undefined'
          ? window.location.pathname.match(/\/shared\/([^/?#]+)/)?.[1]
          : '');

      if (detectedShareId) {
        const directProxyUrl = `/api/shared-file/${encodeURIComponent(detectedShareId)}`;
        try {
          const res = await fetch(directProxyUrl);
          if (res.ok) {
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = resource.fileName || resource.title || 'download';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
            return;
          }
        } catch {
          // Fallback to downloadResourceFile
        }
      }

      await downloadResourceFile(resource);
    } catch (err: any) {
      console.error('[ImageViewerModal] Download failed:', err);
      alert(err.message || 'Failed to download image.');
    } finally {
      setDownloading(false);
    }
  };

  const handleRetry = () => {
    setReloadKey((prev) => prev + 1);
  };

  const displayName = resource.fileName || resource.title;

  return (
    <div
      id="image-viewer-modal-overlay"
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-xs text-slate-100"
      role="dialog"
      aria-modal="true"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-400 shrink-0">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white truncate" title={displayName}>
              {displayName}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="truncate">{resource.subjectName || 'Study Resource'}</span>
              {resource.fileSize && (
                <>
                  <span>•</span>
                  <span>{formatFileSize(resource.fileSize)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            id="image-download-btn"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition shadow cursor-pointer disabled:opacity-50"
            title="Download original image file"
          >
            <Download className={`w-3.5 h-3.5 ${downloading ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">{downloading ? 'Downloading...' : 'Download'}</span>
          </button>
          <button
            type="button"
            id="image-viewer-close-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer"
            aria-label="Close image viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Canvas Area */}
      <div className="flex-1 w-full h-full relative overflow-auto flex items-center justify-center p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-slate-300">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-sm font-medium">Loading image...</p>
          </div>
        ) : error ? (
          <div className="max-w-md w-full p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center flex flex-col items-center gap-4 shadow-xl">
            <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-400 rounded-full">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Unable to load image</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">{error}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full pt-2">
              <button
                type="button"
                onClick={handleRetry}
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download File</span>
              </button>
            </div>
          </div>
        ) : blobUrl ? (
          <div className="w-full h-full flex items-center justify-center overflow-auto">
            <img
              id="image-viewer-display"
              src={blobUrl}
              alt={displayName}
              referrerPolicy="no-referrer"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transition: 'transform 0.15s ease-out',
                maxHeight: '100%',
                maxWidth: '100%'
              }}
              className="object-contain rounded-lg shadow-2xl select-none"
              onError={() => {
                setError('Failed to render the image data.');
              }}
            />
          </div>
        ) : (
          <div className="text-center text-slate-400 p-8">
            <p className="text-sm">No image preview available.</p>
          </div>
        )}
      </div>

      {/* Floating Bottom Toolbar for Zoom/Rotate (only when image is loaded successfully) */}
      {!loading && !error && blobUrl && (
        <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition cursor-pointer"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-300 font-mono w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition cursor-pointer"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-slate-700 mx-1" />
          <button
            type="button"
            onClick={handleRotate}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition cursor-pointer"
            title="Rotate 90°"
            aria-label="Rotate"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition flex items-center gap-1 cursor-pointer"
            title="Reset Zoom & Rotation"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      )}
    </div>
  );
}
