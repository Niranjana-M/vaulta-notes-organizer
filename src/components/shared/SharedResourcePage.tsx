import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StudyResource, ShareRecord } from '../../types';
import { getShareRecord, getResourceById } from '../../services/firestoreService';
import {
  isPdfDoc,
  isWordDoc,
  isImageDoc,
  downloadResourceFile,
  retrieveImageBlob,
  formatFileSize
} from '../../services/storageService';
import { useTheme } from '../../context/ThemeContext';
import { PdfViewerModal } from '../viewers/PdfViewerModal';
import { WordViewerModal } from '../viewers/WordViewerModal';
import { ImageViewerModal } from '../viewers/ImageViewerModal';
import { SharedPdfViewer } from './SharedPdfViewer';
import { DocxContentViewer } from '../viewers/DocxContentViewer';
import {
  BookOpen,
  FileText,
  FileCode,
  Image as ImageIcon,
  Link as LinkIcon,
  Eye,
  Download,
  ExternalLink,
  Sun,
  Moon,
  AlertCircle,
  Loader2,
  Calendar,
  HardDrive,
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
  WifiOff
} from 'lucide-react';

interface SharedResourcePageProps {
  shareId: string;
  onNavigateHome?: () => void;
}

export function SharedResourcePage({
  shareId,
  onNavigateHome
}: SharedResourcePageProps) {
  const { theme, toggleTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shareRecord, setShareRecord] = useState<ShareRecord | null>(null);
  const [resource, setResource] = useState<StudyResource | null>(null);
  const [downloading, setDownloading] = useState(false);

  // In-app viewers reuse
  const [pdfResource, setPdfResource] = useState<StudyResource | null>(null);
  const [wordResource, setWordResource] = useState<StudyResource | null>(null);
  const [imageResource, setImageResource] = useState<StudyResource | null>(null);

  // Inline image preview state using object URL from storage Blob
  const [inlineImageUrl, setInlineImageUrl] = useState<string | null>(null);
  const [inlineImageLoading, setInlineImageLoading] = useState<boolean>(false);
  const [inlineImageError, setInlineImageError] = useState<string | null>(null);
  const inlineBlobUrlRef = useRef<string | null>(null);

  // Load and manage image Blob object URL for inline preview
  useEffect(() => {
    if (!resource || !isImageDoc(resource)) {
      if (inlineBlobUrlRef.current && inlineBlobUrlRef.current.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(inlineBlobUrlRef.current);
        } catch {
          // Ignore revoke error
        }
        inlineBlobUrlRef.current = null;
      }
      setInlineImageUrl(null);
      setInlineImageError(null);
      setInlineImageLoading(false);
      return;
    }

    let isCancelled = false;
    setInlineImageLoading(true);
    setInlineImageError(null);

    // Clean up previous blob URL before creating a new one
    if (inlineBlobUrlRef.current && inlineBlobUrlRef.current.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(inlineBlobUrlRef.current);
      } catch {
        // Ignore revoke error
      }
      inlineBlobUrlRef.current = null;
      setInlineImageUrl(null);
    }

    retrieveImageBlob(resource, shareRecord?.shareId || shareId)
      .then((blob) => {
        if (isCancelled) return;
        if (!blob || blob.size === 0) {
          throw new Error('Unable to load image file from storage.');
        }
        const objectUrl = URL.createObjectURL(blob);
        inlineBlobUrlRef.current = objectUrl;
        setInlineImageUrl(objectUrl);
        setInlineImageLoading(false);
      })
      .catch((err: any) => {
        if (isCancelled) return;
        console.error('[SharedResourcePage] Failed to load inline image preview:', err);
        setInlineImageError(err?.message || 'Unable to load image file from storage.');
        setInlineImageLoading(false);
      });

    return () => {
      isCancelled = true;
      if (inlineBlobUrlRef.current && inlineBlobUrlRef.current.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(inlineBlobUrlRef.current);
        } catch {
          // Ignore revoke error
        }
        inlineBlobUrlRef.current = null;
      }
    };
  }, [resource?.id, resource?.storagePath, resource?.fileUrl, shareRecord?.shareId, shareId]);

  const loadSharedResource = useCallback(async () => {
    setLoading(true);
    setIsUnavailable(false);
    setLoadError(null);

    try {
      // 1. Fetch share record from Firestore and wait for completion
      const record = await getShareRecord(shareId);

      // Condition 1: Share record genuinely does not exist
      if (!record) {
        setIsUnavailable(true);
        setShareRecord(null);
        setResource(null);
        return;
      }

      // Condition 2: Sharing has been disabled by the owner
      if (record.enabled === false) {
        setIsUnavailable(true);
        setShareRecord(null);
        setResource(null);
        return;
      }

      // 2. Fetch the referenced resource from Firestore
      let resourceDoc: StudyResource | null = null;
      if (record.resourceId) {
        try {
          resourceDoc = await getResourceById(record.resourceId);
        } catch (resErr: any) {
          console.warn('[SharedResourcePage] Failed to fetch resource by ID from Firestore, falling back to snapshot:', resErr);
          if (!record.resource) {
            throw resErr;
          }
        }
      }

      // Condition 3: Referenced resource genuinely does not exist
      const source = resourceDoc || (record.resource ? (record.resource as StudyResource) : null);
      if (!source) {
        setIsUnavailable(true);
        setShareRecord(null);
        setResource(null);
        return;
      }

      // Populate resource with Supabase fileUrl or link
      setShareRecord(record);
      setResource({
        id: source.id || record.resourceId,
        userId: source.userId || record.ownerId,
        title: source.title || source.fileName || 'Shared Document',
        subjectId: source.subjectId || 'general',
        subjectName: source.subjectName || 'Study Material',
        resourceType: source.resourceType,
        fileName: source.fileName,
        fileUrl: source.fileUrl,
        storagePath: source.storagePath,
        fileSize: source.fileSize,
        mimeType: source.mimeType,
        uploadDate: source.uploadDate || record.createdAt,
        description: source.description,
        tags: source.tags || [],
        isFavorite: false
      });
    } catch (err: any) {
      console.error('[SharedResourcePage] Error loading shared resource:', err);
      // Explicit requirement: Do NOT treat network delays or errors as "link no longer available"
      setLoadError(err?.message || 'Unable to connect to the database. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [shareId]);

  useEffect(() => {
    loadSharedResource();
  }, [loadSharedResource]);

  const handleOpen = () => {
    if (!resource) return;

    if (isPdfDoc(resource)) {
      setPdfResource(resource);
    } else if (isWordDoc(resource)) {
      setWordResource(resource);
    } else if (isImageDoc(resource)) {
      setImageResource(resource);
    } else if (resource.resourceType === 'link') {
      window.open(resource.fileUrl, '_blank', 'noopener,noreferrer');
    } else {
      // Fallback
      window.open(resource.fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownload = async () => {
    if (!resource) return;

    if (resource.resourceType === 'link') {
      window.open(resource.fileUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setDownloading(true);
    try {
      if (shareRecord?.shareId) {
        const directProxyUrl = `/api/shared-file/${encodeURIComponent(shareRecord.shareId)}`;
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
        } catch (proxyErr) {
          console.warn('[SharedResourcePage] Server proxy download notice, trying storage fallback:', proxyErr);
        }
      }

      await downloadResourceFile(resource);
    } catch (err: any) {
      console.error('[SharedResourcePage] Download error:', err);
      // Fallback direct URL download
      if (resource.fileUrl) {
        const link = document.createElement('a');
        link.href = resource.fileUrl;
        link.download = resource.fileName || resource.title || 'download';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleGoHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.history.pushState({}, '', '/');
      window.location.href = '/';
    }
  };

  const getResourceTypeDetails = () => {
    if (!resource) return null;

    if (isPdfDoc(resource)) {
      return {
        label: 'PDF Document',
        short: 'PDF',
        icon: <FileText className="w-5 h-5 text-rose-600 dark:text-rose-400" />,
        badgeBg:
          'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900',
        cardBorder: 'border-rose-200/80 dark:border-rose-900/60'
      };
    }
    if (isWordDoc(resource)) {
      const isDoc = resource.fileName?.toLowerCase().endsWith('.doc');
      return {
        label: isDoc ? 'Word Document (DOC)' : 'Word Document (DOCX)',
        short: isDoc ? 'DOC' : 'DOCX',
        icon: <FileCode className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
        badgeBg:
          'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900',
        cardBorder: 'border-blue-200/80 dark:border-blue-900/60'
      };
    }
    if (isImageDoc(resource)) {
      return {
        label: 'Image',
        short: 'IMG',
        icon: <ImageIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
        badgeBg:
          'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
        cardBorder: 'border-emerald-200/80 dark:border-emerald-900/60'
      };
    }
    return {
      label: 'Saved Link',
      short: 'LINK',
      icon: <LinkIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
      badgeBg:
        'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900',
      cardBorder: 'border-purple-200/80 dark:border-purple-900/60'
    };
  };

  const typeDetails = getResourceTypeDetails();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased selection:bg-indigo-600 selection:text-white transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div
            id="shared-page-brand"
            onClick={handleGoHome}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs group-hover:bg-indigo-700 transition">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Vaulta
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Academic Knowledge Vault
              </p>
            </div>
          </div>

          {/* Right Actions: Theme Toggle & Return */}
          <div className="flex items-center gap-2">
            <button
              id="shared-theme-toggle"
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            <button
              id="shared-return-vaulta-btn"
              type="button"
              onClick={handleGoHome}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 rounded-xl border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Open Vaulta</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`flex-1 w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col items-center ${resource && isPdfDoc(resource) ? 'max-w-4xl lg:max-w-5xl' : 'max-w-3xl justify-center'}`}>
        {loading ? (
          <div
            id="shared-page-loading"
            className="p-12 text-center flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Loading shared resource...
            </p>
          </div>
        ) : loadError ? (
          /* Network Delay / Connection Error State (Distinct from Link Expired) */
          <div
            id="shared-page-connection-error"
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-10 shadow-lg text-center space-y-4 animate-in fade-in duration-200"
          >
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
              <WifiOff className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                Unable to load shared resource
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                {loadError}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                id="shared-page-retry-btn"
                type="button"
                onClick={() => loadSharedResource()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
              <button
                id="shared-page-error-return-btn"
                type="button"
                onClick={handleGoHome}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Go to Vaulta
              </button>
            </div>
          </div>
        ) : isUnavailable || !resource ? (
          /* Genuinely Unavailable (deleted, disabled, or not found) */
          <div
            id="shared-page-unavailable"
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-10 shadow-lg text-center space-y-4 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                This shared link is no longer available.
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                The resource owner may have disabled sharing or removed this link. Please request a
                fresh share link from the owner.
              </p>
            </div>

            <div className="pt-2">
              <button
                id="shared-page-return-btn"
                type="button"
                onClick={handleGoHome}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                <span>Go to Vaulta</span>
              </button>
            </div>
          </div>
        ) : (
          /* Valid Shared Resource Card */
          <div
            id="shared-resource-card"
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6 animate-in fade-in duration-300"
          >
            {/* Header Badge */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <span
                  id="shared-resource-pill"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Shared Resource
                </span>

                {resource.subjectName && (
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 truncate max-w-[180px]">
                    {resource.subjectName}
                  </span>
                )}
              </div>

              {/* Resource Type Badge */}
              {typeDetails && (
                <div
                  id="shared-resource-type-badge"
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${typeDetails.badgeBg}`}
                >
                  {typeDetails.icon}
                  <span>{typeDetails.label}</span>
                </div>
              )}
            </div>

            {/* Resource Name and Metadata */}
            <div className="space-y-3">
              <h2
                id="shared-resource-name"
                className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-snug"
              >
                {resource.title}
              </h2>

              {resource.description && (
                <p
                  id="shared-resource-description"
                  className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed"
                >
                  {resource.description}
                </p>
              )}

              {/* Tags if present */}
              {resource.tags && resource.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {resource.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* File Meta Info */}
              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    Uploaded on{' '}
                    {new Date(resource.uploadDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </span>

                {typeof resource.fileSize === 'number' && resource.fileSize > 0 && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>{formatFileSize(resource.fileSize)}</span>
                    </span>
                  </>
                )}
              </div>

              {/* Inline Visual Preview for Images */}
              {isImageDoc(resource) && (
                <div
                  id="shared-image-preview-container"
                  className="w-full mt-4 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-3 sm:p-4 min-h-[220px]"
                >
                  {inlineImageLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-slate-500 dark:text-slate-400">
                      <Loader2 className="w-7 h-7 animate-spin text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-semibold">Loading image preview...</span>
                    </div>
                  ) : inlineImageError ? (
                    <div className="py-8 px-4 text-center flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400 max-w-md">
                      <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Unable to load image</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {inlineImageError}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (resource) {
                              setInlineImageLoading(true);
                              setInlineImageError(null);
                              retrieveImageBlob(resource, shareRecord?.shareId || shareId)
                                .then((blob) => {
                                  const objectUrl = URL.createObjectURL(blob);
                                  inlineBlobUrlRef.current = objectUrl;
                                  setInlineImageUrl(objectUrl);
                                  setInlineImageLoading(false);
                                })
                                .catch((err) => {
                                  setInlineImageError(err?.message || 'Unable to load image file from storage.');
                                  setInlineImageLoading(false);
                                });
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Retry</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDownload}
                          disabled={downloading}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Image</span>
                        </button>
                      </div>
                    </div>
                  ) : inlineImageUrl ? (
                    <div
                      className="group cursor-pointer w-full flex justify-center"
                      onClick={() => setImageResource(resource)}
                      title="Click to expand image"
                    >
                      <img
                        id="shared-resource-image"
                        src={inlineImageUrl}
                        alt={resource.title || 'Shared study resource'}
                        className="max-h-[460px] w-auto max-w-full object-contain rounded-xl shadow-xs group-hover:scale-[1.01] transition duration-200"
                        loading="eager"
                      />
                    </div>
                  ) : null}
                </div>
              )}

              {/* PDF Document Viewer: Renders the actual PDF content visibly using PDF.js */}
              {isPdfDoc(resource) && (
                <div id="shared-pdf-content-wrapper" className="w-full pt-2">
                  <SharedPdfViewer
                    resource={resource}
                    shareId={shareRecord?.shareId}
                    onDownload={handleDownload}
                    onOpenFullscreen={() => setPdfResource(resource)}
                  />
                </div>
              )}

              {/* Word Document Viewer: Renders the actual DOCX content visibly using Mammoth.js */}
              {isWordDoc(resource) && (
                <div id="shared-docx-content-wrapper" className="w-full pt-2">
                  <DocxContentViewer
                    resource={resource}
                    shareId={shareRecord?.shareId}
                    onDownload={handleDownload}
                    onOpenFullscreen={() => setWordResource(resource)}
                    compact={true}
                  />
                </div>
              )}
            </div>

            {/* Primary Action Buttons: [ Open ] and [ Download ] */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* [ Open ] */}
              <button
                id="shared-resource-open-btn"
                type="button"
                onClick={handleOpen}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-600/10 transition cursor-pointer"
              >
                {resource.resourceType === 'link' ? (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    <span>Open Link</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    <span>Open</span>
                  </>
                )}
              </button>

              {/* [ Download ] */}
              {resource.resourceType !== 'link' && (
                <button
                  id="shared-resource-download-btn"
                  type="button"
                  disabled={downloading}
                  onClick={handleDownload}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.99] text-slate-800 dark:text-slate-100 font-bold text-sm rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-50"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Downloading...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Download</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-400 dark:text-slate-600 border-t border-slate-200 dark:border-slate-850">
        <p>Vaulta • Read-only shared resource preview</p>
      </footer>

      {/* Reused In-App Viewers */}
      <PdfViewerModal
        resource={pdfResource}
        onClose={() => setPdfResource(null)}
      />

      <WordViewerModal
        resource={wordResource}
        onClose={() => setWordResource(null)}
        shareId={shareRecord?.shareId || shareId}
      />

      <ImageViewerModal
        resource={imageResource}
        onClose={() => setImageResource(null)}
        shareId={shareRecord?.shareId || shareId}
      />
    </div>
  );
}
