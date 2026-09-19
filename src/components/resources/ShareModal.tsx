import React, { useState, useEffect, useCallback } from 'react';
import { StudyResource, ShareRecord } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../lib/firebase';
import {
  createOrGetShareRecord,
  disableShareRecord,
  enableShareRecord
} from '../../services/firestoreService';
import { buildShareUrl, copyTextToClipboard } from '../../services/shareService';
import { isPdfDoc, isWordDoc, isImageDoc, getFileFromLocalDB } from '../../services/storageService';
import {
  X,
  Share2,
  Copy,
  Check,
  PowerOff,
  RefreshCw,
  Loader2,
  FileText,
  FileCode,
  Image as ImageIcon,
  Link as LinkIcon,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  MessageCircle,
  Instagram,
  Send,
  Mail
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  resource: StudyResource | null;
  onClose: () => void;
}

export function ShareModal({ isOpen, resource, onClose }: ShareModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [shareRecord, setShareRecord] = useState<ShareRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadShare = useCallback(async () => {
    if (!resource) return;
    setLoading(true);
    setError(null);
    setCopied(false);
    setFeedbackMessage(null);

    try {
      const currentUid = auth.currentUser?.uid || user?.uid;
      if (!currentUid) {
        throw new Error('You must be signed in to create or activate a share link.');
      }
      // Guarantees persistence in Firestore using authenticated UID before setting shareRecord
      const record = await createOrGetShareRecord(resource, currentUid);
      setShareRecord(record);

      // Background sync: sync original file bytes to server proxy cache
      // Guarantees immediate, pristine retrieval for Incognito and public visitors
      (async () => {
        try {
          let fileBlob: Blob | null = null;
          const candidateKey = resource.storagePath || resource.fileUrl || '';
          const localUrl = await getFileFromLocalDB(candidateKey, resource.fileName || resource.title);
          if (localUrl) {
            const res = await fetch(localUrl);
            if (res.ok) fileBlob = await res.blob();
          }
          if (
            !fileBlob &&
            resource.fileUrl &&
            (resource.fileUrl.startsWith('http://') || resource.fileUrl.startsWith('https://'))
          ) {
            const res = await fetch(resource.fileUrl);
            if (res.ok) fileBlob = await res.blob();
          }
          if (fileBlob) {
            await fetch(
              `/api/share-cache/${encodeURIComponent(record.shareId)}?fileName=${encodeURIComponent(
                resource.fileName || resource.title || 'document'
              )}&mimeType=${encodeURIComponent(resource.mimeType || fileBlob.type)}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/octet-stream' },
                body: fileBlob
              }
            );
          }
        } catch (e) {
          // ignore background sync errors
        }
      })();
    } catch (err: any) {
      console.error('[ShareModal] Failed to get/create share record:', err);
      setError(err?.message || 'Failed to save share record to Firestore. Please try again.');
      setShareRecord(null);
    } finally {
      setLoading(false);
    }
  }, [resource, user?.uid]);

  // Load or generate share link when modal opens
  useEffect(() => {
    if (!isOpen || !resource) {
      setShareRecord(null);
      setCopied(false);
      setFeedbackMessage(null);
      setError(null);
      return;
    }

    loadShare();
  }, [isOpen, resource, loadShare]);

  if (!isOpen || !resource) return null;

  const shareUrl = shareRecord ? buildShareUrl(shareRecord.shareId) : '';

  const handleCopy = async () => {
    if (!shareUrl) return;
    const success = await copyTextToClipboard(shareUrl);
    if (success) {
      setCopied(true);
      setFeedbackMessage('Link copied successfully!');
      setTimeout(() => {
        setCopied(false);
      }, 3000);
    } else {
      setFeedbackMessage('Unable to copy to clipboard.');
    }
  };

  const handleShareWhatsApp = () => {
    if (!shareUrl || !resource) return;
    const message = `Check out this resource from Vaulta:\n\n${resource.title}\n\n${shareUrl}`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShareInstagram = async () => {
    if (!shareUrl) return;
    await copyTextToClipboard(shareUrl);
    setCopied(false);
    setFeedbackMessage('Link copied! You can paste it into Instagram.');
    try {
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.warn('[ShareModal] Failed to open Instagram:', err);
    }
  };

  const handleShareTelegram = () => {
    if (!shareUrl || !resource) return;
    const message = `Check out this resource from Vaulta:\n\n${resource.title}`;
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(message)}`;
    window.open(telegramUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShareEmail = () => {
    if (!shareUrl || !resource) return;
    const subject = `Vaulta Resource: ${resource.title}`;
    const body = `Check out this resource from Vaulta:\n\n${resource.title}\n\n${shareUrl}`;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  const handleToggleSharing = async () => {
    if (!shareRecord) return;
    setActionLoading(true);
    setFeedbackMessage(null);

    try {
      if (shareRecord.enabled) {
        await disableShareRecord(shareRecord.shareId);
        setShareRecord((prev) => (prev ? { ...prev, enabled: false } : null));
        setFeedbackMessage('Sharing disabled. This link is now inactive.');
      } else {
        await enableShareRecord(shareRecord.shareId);
        setShareRecord((prev) => (prev ? { ...prev, enabled: true } : null));
        setFeedbackMessage('Sharing enabled. The link is now active.');
      }
    } catch (err: any) {
      console.error('[ShareModal] Toggle sharing error:', err);
      setError(err.message || 'Failed to update sharing status.');
    } finally {
      setActionLoading(false);
    }
  };

  const getResourceIcon = () => {
    if (isPdfDoc(resource)) {
      return <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
    }
    if (isWordDoc(resource)) {
      return <FileCode className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
    if (isImageDoc(resource)) {
      return <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    }
    return <LinkIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
  };

  const getTypeLabel = () => {
    if (isPdfDoc(resource)) return 'PDF Document';
    if (isWordDoc(resource)) {
      const ext = resource.fileName?.toLowerCase().endsWith('.doc') ? 'DOC' : 'DOCX';
      return `${ext} Document`;
    }
    if (isImageDoc(resource)) return 'Image';
    return 'Saved Link';
  };

  return (
    <div
      id="share-resource-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="share-resource-modal-card"
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-200 text-slate-800 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Share Resource
              </h2>
            </div>
          </div>
          <button
            id="share-modal-close-x-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resource Details Preview */}
        <div className="p-3 bg-slate-50 dark:bg-slate-850/70 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center gap-2">
            {getResourceIcon()}
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {getTypeLabel()}
            </span>
            {resource.subjectName && (
              <>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">
                  {resource.subjectName}
                </span>
              </>
            )}
          </div>
          <p
            id="share-modal-resource-name"
            title={resource.title}
            className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2"
          >
            {resource.title}
          </p>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-medium">Generating unique share link...</span>
          </div>
        ) : error ? (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div className="flex-1">
                <span className="font-semibold block">Failed to activate share link</span>
                <span className="text-[11px] text-rose-600 dark:text-rose-400">{error}</span>
              </div>
            </div>
            <div className="pt-1">
              <button
                id="share-modal-retry-btn"
                type="button"
                onClick={() => loadShare()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 dark:bg-rose-900/60 hover:bg-rose-200 dark:hover:bg-rose-800 text-rose-800 dark:text-rose-200 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        ) : shareRecord ? (
          <div className="space-y-3.5">
            {/* Active Link Box */}
            {shareRecord.enabled ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Unique Share Link</span>
                  <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Read-only link active
                  </span>
                </label>

                {/* Input + Copy Link Button */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      id="share-link-input"
                      type="text"
                      readOnly
                      value={shareUrl}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="w-full text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-slate-700 dark:text-slate-300 focus:outline-hidden select-all"
                    />
                  </div>

                  <button
                    id="share-modal-copy-btn"
                    type="button"
                    onClick={handleCopy}
                    className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 shadow-xs ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>

                {/* "Link copied successfully!" announcement */}
                {feedbackMessage && (
                  <p
                    id="share-modal-feedback-message"
                    className={`text-xs font-medium transition-opacity ${
                      copied || feedbackMessage.includes('Link copied')
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {feedbackMessage}
                  </p>
                )}

                {/* Share via section */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Share via
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {/* WhatsApp */}
                    <button
                      id="share-whatsapp-btn"
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-850 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-800/80 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer group"
                      title="Share via WhatsApp"
                    >
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500/25 shrink-0 transition-colors">
                        <MessageCircle className="w-3.5 h-3.5" />
                      </span>
                      <span>WhatsApp</span>
                    </button>

                    {/* Instagram */}
                    <button
                      id="share-instagram-btn"
                      type="button"
                      onClick={handleShareInstagram}
                      className="min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-850 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-300 dark:hover:border-rose-800/80 text-slate-700 dark:text-slate-200 hover:text-rose-700 dark:hover:text-rose-300 flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer group"
                      title="Share via Instagram"
                    >
                      <span className="w-6 h-6 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center group-hover:bg-rose-500/25 shrink-0 transition-colors">
                        <Instagram className="w-3.5 h-3.5" />
                      </span>
                      <span>Instagram</span>
                    </button>

                    {/* Telegram */}
                    <button
                      id="share-telegram-btn"
                      type="button"
                      onClick={handleShareTelegram}
                      className="min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-850 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:border-sky-300 dark:hover:border-sky-800/80 text-slate-700 dark:text-slate-200 hover:text-sky-700 dark:hover:text-sky-300 flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer group"
                      title="Share via Telegram"
                    >
                      <span className="w-6 h-6 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:bg-sky-500/25 shrink-0 transition-colors">
                        <Send className="w-3.5 h-3.5" />
                      </span>
                      <span>Telegram</span>
                    </button>

                    {/* Email */}
                    <button
                      id="share-email-btn"
                      type="button"
                      onClick={handleShareEmail}
                      className="min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-850 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-800/80 text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer group"
                      title="Share via Email"
                    >
                      <span className="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-500/25 shrink-0 transition-colors">
                        <Mail className="w-3.5 h-3.5" />
                      </span>
                      <span>Email</span>
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Anyone with this link can view and download this specific resource. Your other
                  vault files and personal account details remain private.
                </p>
              </div>
            ) : (
              /* Disabled State */
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-900 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold">Sharing is currently disabled</span>
                </div>
                <p className="text-xs text-amber-700/90 dark:text-amber-400/90 leading-relaxed">
                  Anyone who opens this share link will see:
                  <br />
                  <span className="italic font-semibold">
                    &quot;This shared link is no longer available.&quot;
                  </span>
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-500">
                  Your original file in Vaulta remains safe and unchanged.
                </p>
              </div>
            )}

            {/* Action Buttons: Disable / Re-enable Sharing & Close */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              {shareRecord.enabled ? (
                <button
                  id="share-modal-disable-btn"
                  type="button"
                  disabled={actionLoading}
                  onClick={handleToggleSharing}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl border border-rose-200 dark:border-rose-900 transition cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <PowerOff className="w-3.5 h-3.5" />
                  )}
                  <span>Disable Sharing</span>
                </button>
              ) : (
                <button
                  id="share-modal-enable-btn"
                  type="button"
                  disabled={actionLoading}
                  onClick={handleToggleSharing}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl border border-indigo-200 dark:border-indigo-800 transition cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>Re-enable Sharing</span>
                </button>
              )}

              <button
                id="share-modal-close-btn"
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
