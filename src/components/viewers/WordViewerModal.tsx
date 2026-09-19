import React, { useState, useEffect, useRef } from 'react';
import { StudyResource } from '../../types';
import { formatFileSize, downloadResourceFile } from '../../services/storageService';
import { retrieveDocxBytes, convertDocxToHtml } from '../../services/docxService';
import { ErrorBoundary } from '../common/ErrorBoundary';
import {
  X,
  Download,
  FileCode,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertCircle,
  RefreshCw,
  FileText,
  Info,
  Loader2
} from 'lucide-react';

interface WordViewerModalProps {
  resource: StudyResource | null;
  onClose: () => void;
  shareId?: string;
}

function WordViewerModalInternal({ resource, onClose, shareId }: WordViewerModalProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'info'>('preview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [downloading, setDownloading] = useState(false);
  const [loadedBlob, setLoadedBlob] = useState<Blob | null>(null);
  const [docxHtml, setDocxHtml] = useState<string>('');
  const [isLegacyDoc, setIsLegacyDoc] = useState(false);
  const [renderCount, setRenderCount] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Compute format and detection
  const fileNameLower = (resource?.fileName || resource?.title || '').toLowerCase().trim();
  const isLegacyDocByName =
    (fileNameLower.endsWith('.doc') && !fileNameLower.endsWith('.docx')) ||
    resource?.mimeType?.toLowerCase() === 'application/msword';

  // Load and render document using Mammoth
  useEffect(() => {
    if (!resource) {
      setLoading(false);
      setError(null);
      return;
    }

    if (isLegacyDocByName) {
      setIsLegacyDoc(true);
      setLoading(false);
      setError(null);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setError(null);
    setIsLegacyDoc(false);
    setDocxHtml('');

    async function loadAndRender() {
      if (!resource) return;

      try {
        console.log('[WordViewerModal] Fetching DOCX bytes for:', resource.fileName || resource.title);
        const { buffer, blob, isLegacyDoc: legacy } = await retrieveDocxBytes(resource, shareId);

        if (isCancelled) return;

        setLoadedBlob(blob);

        if (legacy) {
          setIsLegacyDoc(true);
          setLoading(false);
          return;
        }

        console.log('[WordViewerModal] Converting DOCX to HTML with Mammoth...');
        const { html } = await convertDocxToHtml(buffer);

        if (isCancelled) return;

        setDocxHtml(html);
        setLoading(false);
      } catch (err: any) {
        if (!isCancelled) {
          const msg = err?.message || '';
          if (
            msg.includes('LEGACY_DOC_NON_ZIP') ||
            msg.includes("Can't find end of central directory") ||
            msg.includes('is this a zip file') ||
            msg.includes('End of data reached')
          ) {
            console.log('[WordViewerModal] Document is in legacy or non-ZIP format. Displaying legacy viewer.');
            setIsLegacyDoc(true);
            setLoading(false);
            return;
          }

          console.error('[WordViewerModal] DOCX loading error:', err);
          setError(err?.message || 'Unable to retrieve or parse DOCX document.');
          setLoading(false);
        }
      }
    }

    loadAndRender();

    return () => {
      isCancelled = true;
    };
  }, [resource?.id, resource?.fileUrl, resource?.storagePath, renderCount, isLegacyDocByName, shareId]);

  if (!resource) return null;

  const handleDownload = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (downloading) return;

    setDownloading(true);

    try {
      if (loadedBlob) {
        const fileName = (resource.fileName || resource.title || 'document.docx').trim();
        const safeName =
          fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc')
            ? fileName
            : `${fileName}.${isLegacyDoc ? 'doc' : 'docx'}`;

        const downloadUrl = URL.createObjectURL(loadedBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = downloadUrl;
        a.download = safeName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 8000);
        return;
      }

      await downloadResourceFile(resource);
    } catch (err: any) {
      console.error('[WordViewerModal] Download failed:', err);
      await downloadResourceFile(resource);
    } finally {
      setDownloading(false);
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 15, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 15, 60));
  const handleResetZoom = () => setZoom(100);

  const isDocx = !isLegacyDoc;

  return (
    <div
      id="word-viewer-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden"
    >
      <div
        id="word-viewer-modal-window"
        className="bg-slate-900 border border-slate-800 w-full max-w-5xl h-[94vh] rounded-2xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Top Header Bar */}
        <div className="bg-slate-950/95 border-b border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <FileCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="word-viewer-doc-title"
                className="text-sm sm:text-base font-bold text-white truncate max-w-[200px] sm:max-w-md md:max-w-lg"
              >
                {resource.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="truncate">{resource.subjectName}</span>
                {resource.fileSize ? (
                  <>
                    <span>•</span>
                    <span>{formatFileSize(resource.fileSize)}</span>
                  </>
                ) : null}
                <span>•</span>
                <span
                  className={`uppercase text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                    isDocx
                      ? 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
                      : 'bg-amber-900/60 text-amber-300 border border-amber-700/50'
                  }`}
                >
                  {isDocx ? 'DOCX' : 'DOC'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="word-download-top-btn"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Download className={`w-3.5 h-3.5 ${downloading ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">
                {downloading ? 'Downloading...' : 'Download Original'}
              </span>
            </button>
            <button
              id="word-viewer-close-btn"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
              aria-label="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation & Zoom Sub-bar */}
        <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto text-xs shrink-0">
          <div className="flex items-center gap-1.5">
            {isDocx ? (
              <>
                <button
                  type="button"
                  id="tab-doc-preview-btn"
                  onClick={() => setActiveTab('preview')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    activeTab === 'preview'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Document Preview</span>
                </button>
                <button
                  type="button"
                  id="tab-doc-info-btn"
                  onClick={() => setActiveTab('info')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    activeTab === 'info'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>File Details & Info</span>
                </button>
              </>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-amber-400 font-semibold px-2.5 py-1 bg-amber-950/40 rounded-lg border border-amber-800/60">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Legacy Word .doc format</span>
              </div>
            )}
          </div>

          {/* Zoom & Refresh Controls for Preview */}
          {isDocx && activeTab === 'preview' && !loading && !error && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center bg-slate-800/90 rounded-xl border border-slate-700/60 p-0.5">
                <button
                  type="button"
                  id="word-zoom-out-btn"
                  onClick={handleZoomOut}
                  disabled={zoom <= 60}
                  className="p-1.5 text-slate-300 hover:text-white disabled:opacity-40 rounded transition cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono text-[11px] text-slate-200 min-w-[44px] text-center font-bold">
                  {zoom}%
                </span>
                <button
                  type="button"
                  id="word-zoom-in-btn"
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                  className="p-1.5 text-slate-300 hover:text-white disabled:opacity-40 rounded transition cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                {zoom !== 100 && (
                  <button
                    type="button"
                    onClick={handleResetZoom}
                    className="p-1.5 text-slate-400 hover:text-white rounded transition cursor-pointer"
                    title="Reset Zoom to 100%"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Content Display Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-slate-950 flex flex-col items-center p-4 sm:p-8"
        >
          {/* Case 1: Loading State */}
          {loading && (
            <div
              id="word-viewer-loading"
              className="my-auto flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
              </div>
              <h4 className="text-base font-bold text-white">Loading Document...</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Retrieving and formatting document paragraphs, headings, tables, and images.
              </p>
            </div>
          )}

          {/* Case 2: Error State (Strict User Specification) */}
          {error && !loading && (
            <div
              id="word-viewer-error-box"
              className="my-auto max-w-md w-full p-6 sm:p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center shadow-2xl text-white"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>

              <h4 className="text-lg font-bold text-white">Unable to preview this document.</h4>

              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                The document content could not be rendered in the browser. You can retry loading or download the original file.
              </p>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowErrorDetails(!showErrorDetails)}
                  className="text-[11px] text-slate-500 hover:text-slate-400 underline cursor-pointer"
                >
                  {showErrorDetails ? 'Hide error details' : 'Show error details'}
                </button>
                {showErrorDetails && (
                  <div className="mt-2 p-2 bg-slate-800/80 rounded-lg text-left text-[11px] font-mono text-slate-300 break-all border border-slate-700">
                    {error}
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  id="word-error-retry-btn"
                  type="button"
                  onClick={() => setRenderCount((c) => c + 1)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Preview</span>
                </button>

                <button
                  id="word-error-download-btn"
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Original</span>
                </button>
              </div>
            </div>
          )}

          {/* Case 3: Legacy Word (.doc) Binary */}
          {isLegacyDoc && !loading && !error && (
            <div className="my-auto max-w-md w-full p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center shadow-2xl text-white animate-in fade-in">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center mb-4">
                <FileCode className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">
                Microsoft Word 97-2003 Document (.doc)
              </h3>
              <p className="text-sm text-slate-400 mb-6">
                This document is saved in the legacy Word binary format. Direct download is provided to view it with original formatting in Microsoft Word.
              </p>

              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 text-left text-xs space-y-2 mb-6 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">File Name:</span>
                  <span className="font-semibold text-white truncate max-w-[200px]">
                    {resource.fileName || resource.title}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Subject:</span>
                  <span className="font-semibold text-white">{resource.subjectName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">File Size:</span>
                  <span className="font-medium text-white">{formatFileSize(resource.fileSize)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Document (.doc)</span>
              </button>
            </div>
          )}

          {/* Case 4: File Details Tab */}
          {activeTab === 'info' && !loading && (
            <div className="my-auto max-w-lg w-full p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center shadow-2xl text-white animate-in fade-in">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mx-auto flex items-center justify-center mb-4">
                <FileCode className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">{resource.title}</h3>
              <p className="text-sm text-slate-400 mb-4">{resource.fileName || 'Microsoft Word Document'}</p>

              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 text-left text-xs space-y-2.5 mb-6 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subject:</span>
                  <span className="font-semibold text-white">{resource.subjectName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">File Size:</span>
                  <span className="font-medium text-white">{formatFileSize(resource.fileSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Format:</span>
                  <span className="font-medium text-white">Microsoft Word (.docx)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Upload Date:</span>
                  <span className="font-medium text-white">
                    {new Date(resource.uploadDate).toLocaleDateString()}
                  </span>
                </div>
                {resource.description && (
                  <div className="pt-2 border-t border-slate-700">
                    <span className="text-slate-500 block mb-1">Description:</span>
                    <p className="text-slate-300 font-normal leading-relaxed">{resource.description}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Original</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl border border-slate-700 transition cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Return to Document Preview</span>
                </button>
              </div>
            </div>
          )}

          {/* Case 5: Actual DOCX Document Content Display */}
          {activeTab === 'preview' && !loading && !error && !isLegacyDoc && docxHtml && (
            <div
              id="docx-rendered-paper-container"
              style={{
                transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out'
              }}
              className="w-full max-w-4xl flex justify-center py-2"
            >
              <div
                id="docx-rendered-paper"
                className="w-full bg-white text-slate-900 shadow-2xl rounded-xl border border-slate-200/90 p-8 sm:p-14 min-h-[600px]"
              >
                <div
                  id="docx-html-body"
                  className="docx-html-body"
                  dangerouslySetInnerHTML={{ __html: docxHtml }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function WordViewerModal(props: WordViewerModalProps) {
  return (
    <ErrorBoundary
      fallbackTitle="Word Viewer Error"
      fallbackMessage="An unexpected error occurred in the Word document viewer."
      onReset={props.onClose}
    >
      <WordViewerModalInternal {...props} />
    </ErrorBoundary>
  );
}
