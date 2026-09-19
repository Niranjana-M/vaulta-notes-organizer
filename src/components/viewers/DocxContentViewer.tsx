import React, { useState, useEffect, useRef } from 'react';
import { StudyResource } from '../../types';
import { retrieveDocxBytes, convertDocxToHtml } from '../../services/docxService';
import { downloadResourceFile } from '../../services/storageService';
import {
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
  AlertCircle,
  FileCode,
  Maximize2,
  RefreshCw,
  FileText
} from 'lucide-react';

interface DocxContentViewerProps {
  resource: StudyResource;
  shareId?: string;
  onDownload?: () => void;
  onOpenFullscreen?: () => void;
  compact?: boolean;
}

export function DocxContentViewer({
  resource,
  shareId,
  onDownload,
  onOpenFullscreen,
  compact = false
}: DocxContentViewerProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [scale, setScale] = useState<number>(1);
  const [isLegacyDoc, setIsLegacyDoc] = useState<boolean>(false);
  const [retrievedBlob, setRetrievedBlob] = useState<Blob | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [showErrorDetails, setShowErrorDetails] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isCancelledRef = useRef<boolean>(false);

  const loadDocument = async () => {
    setLoading(true);
    setError(null);
    setIsLegacyDoc(false);
    setHtmlContent('');
    isCancelledRef.current = false;

    try {
      console.log('[DocxContentViewer] Retrieving DOCX bytes for:', resource.title || resource.fileName);
      const { buffer, blob, isLegacyDoc: legacy } = await retrieveDocxBytes(resource, shareId);

      if (isCancelledRef.current) return;

      setRetrievedBlob(blob);

      if (legacy) {
        setIsLegacyDoc(true);
        setLoading(false);
        return;
      }

      console.log('[DocxContentViewer] Converting DOCX to HTML via Mammoth...');
      const { html } = await convertDocxToHtml(buffer);

      if (isCancelledRef.current) return;

      setHtmlContent(html);
      setLoading(false);
    } catch (err: any) {
      if (isCancelledRef.current) return;
      const msg = err?.message || '';
      if (
        msg.includes('LEGACY_DOC_NON_ZIP') ||
        msg.includes("Can't find end of central directory") ||
        msg.includes('is this a zip file') ||
        msg.includes('End of data reached')
      ) {
        console.log('[DocxContentViewer] Document is in legacy or non-ZIP format. Displaying legacy viewer.');
        setIsLegacyDoc(true);
        setLoading(false);
        return;
      }
      console.error('[DocxContentViewer] Failed to load/render DOCX:', err);
      setError(err?.message || 'Unable to load document bytes from storage.');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocument();
    return () => {
      isCancelledRef.current = true;
    };
  }, [resource.id, resource.fileUrl, resource.storagePath, shareId]);

  const handleDownloadOriginal = async () => {
    if (downloading) return;
    setDownloading(true);

    try {
      if (onDownload) {
        await onDownload();
      } else if (retrievedBlob) {
        const fileName = (resource.fileName || resource.title || 'document.docx').trim();
        const safeName = fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc')
          ? fileName
          : `${fileName}.docx`;

        const blobUrl = URL.createObjectURL(retrievedBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = safeName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      } else {
        await downloadResourceFile(resource);
      }
    } catch (err) {
      console.error('[DocxContentViewer] Download failed:', err);
      await downloadResourceFile(resource);
    } finally {
      setDownloading(false);
    }
  };

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.15, 2.0));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.15, 0.6));
  const handleZoomReset = () => setScale(1);

  return (
    <div
      id="docx-content-viewer-root"
      className="w-full flex flex-col rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/80 shadow-sm transition"
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        {/* Document Identifier */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <FileCode className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate max-w-[220px] sm:max-w-md">
              {resource.title || resource.fileName || 'Word Document'}
            </h4>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {isLegacyDoc ? 'Legacy Word Document (.doc)' : 'Microsoft Word (.docx)'}
            </span>
          </div>
        </div>

        {/* Action & Zoom Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
          {/* Zoom controls (active when content is visible) */}
          {!loading && !error && !isLegacyDoc && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700 mr-1">
              <button
                id="docx-zoom-out-btn"
                type="button"
                onClick={handleZoomOut}
                disabled={scale <= 0.6}
                title="Zoom Out"
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-40 transition cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                id="docx-zoom-reset-btn"
                type="button"
                onClick={handleZoomReset}
                title="Reset Zoom to 100%"
                className="px-1.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                id="docx-zoom-in-btn"
                type="button"
                onClick={handleZoomIn}
                disabled={scale >= 2.0}
                title="Zoom In"
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-40 transition cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Fullscreen Button if prop provided */}
          {onOpenFullscreen && (
            <button
              id="docx-fullscreen-btn"
              type="button"
              onClick={onOpenFullscreen}
              title="Open Fullscreen Preview"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Fullscreen</span>
            </button>
          )}

          {/* Download Original Button */}
          <button
            id="docx-download-original-btn"
            type="button"
            onClick={handleDownloadOriginal}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            {downloading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download Original</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        ref={containerRef}
        className={`w-full overflow-auto flex flex-col items-center p-4 sm:p-8 bg-slate-200/60 dark:bg-slate-950/80 ${
          compact ? 'max-h-[600px] min-h-[360px]' : 'min-h-[500px]'
        }`}
      >
        {/* Loading State */}
        {loading && (
          <div
            id="docx-loading-state"
            className="my-auto flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/50 flex items-center justify-center mb-4">
              <Loader2 className="w-7 h-7 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <h5 className="text-sm font-bold text-slate-900 dark:text-white">
              Loading Document...
            </h5>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
              Retrieving and rendering formatting, tables, and document content.
            </p>
          </div>
        )}

        {/* Error State: Strict matching with User Specification */}
        {error && !loading && (
          <div
            id="docx-error-state"
            className="my-auto max-w-md w-full p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center shadow-lg text-slate-900 dark:text-white"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/50 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Unable to preview this document.
            </h4>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              The document content could not be rendered in the browser. You can retry loading or download the original file to open it in Microsoft Word.
            </p>

            {/* Error Message for Debugging */}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline cursor-pointer"
              >
                {showErrorDetails ? 'Hide error details' : 'Show error details'}
              </button>
              {showErrorDetails && (
                <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-left text-[11px] font-mono text-slate-700 dark:text-slate-300 break-all border border-slate-200 dark:border-slate-700">
                  {error}
                </div>
              )}
            </div>

            {/* Strict Required Actions: [ Retry Preview ] [ Download Original ] */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                id="docx-retry-btn"
                type="button"
                onClick={loadDocument}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Preview</span>
              </button>

              <button
                id="docx-error-download-btn"
                type="button"
                onClick={handleDownloadOriginal}
                disabled={downloading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Original</span>
              </button>
            </div>
          </div>
        )}

        {/* Legacy Word (.doc) Notification */}
        {isLegacyDoc && !loading && !error && (
          <div
            id="docx-legacy-state"
            className="my-auto max-w-md w-full p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center shadow-lg text-slate-900 dark:text-white"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center mb-3">
              <FileCode className="w-6 h-6" />
            </div>

            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Microsoft Word 97-2003 Document (.doc)
            </h4>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              This file is saved in the legacy binary Word format. Direct download is provided to view it with original formatting in Microsoft Word.
            </p>

            <div className="mt-5 flex justify-center">
              <button
                id="docx-legacy-download-btn"
                type="button"
                onClick={handleDownloadOriginal}
                disabled={downloading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Original (.doc)</span>
              </button>
            </div>
          </div>
        )}

        {/* Document Content Paper Rendering */}
        {!loading && !error && !isLegacyDoc && htmlContent && (
          <div
            id="docx-rendered-paper-wrapper"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out'
            }}
            className="w-full max-w-4xl flex justify-center py-2"
          >
            <div
              id="docx-rendered-paper"
              className="w-full bg-white text-slate-900 shadow-2xl rounded-xl border border-slate-200/90 p-8 sm:p-14 min-h-[500px]"
            >
              <div
                id="docx-html-body"
                className="docx-html-body"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
