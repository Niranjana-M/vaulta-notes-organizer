import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Subject, COMMON_TAGS } from '../../types';
import { createResource, checkDuplicateResource } from '../../services/firestoreService';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Link as LinkIcon, X, Check, Globe, Tag as TagIcon, Plus, AlertCircle } from 'lucide-react';

interface AddLinkModalProps {
  isOpen: boolean;
  subjects: Subject[];
  defaultSubjectId?: string;
  onClose: () => void;
  onSuccess?: () => void;
  onOpenCreateSubject?: () => void;
}

export function AddLinkModal({
  isOpen,
  subjects,
  defaultSubjectId,
  onClose,
  onSuccess,
  onOpenCreateSubject
}: AddLinkModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState(defaultSubjectId || (subjects[0]?.id ?? ''));
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync subjectId whenever modal is opened or defaultSubjectId/subjects change
  useEffect(() => {
    if (isOpen) {
      if (defaultSubjectId && subjects.some((s) => s.id === defaultSubjectId)) {
        setSubjectId(defaultSubjectId);
      } else if (subjects.length > 0) {
        setSubjectId(subjects[0].id);
      }
    }
  }, [isOpen, defaultSubjectId, subjects]);

  // Duplicate prompt
  const [duplicateUrl, setDuplicateUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomTag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const clean = customTag.trim();
    if (clean && !selectedTags.includes(clean)) {
      setSelectedTags((prev) => [...prev, clean]);
      setCustomTag('');
    }
  };

  const cleanUrl = (raw: string): string => {
    let formatted = raw.trim();
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = 'https://' + formatted;
    }
    return formatted;
  };

  const isValidUrl = (testUrl: string) => {
    try {
      new URL(testUrl);
      return true;
    } catch {
      return false;
    }
  };

  const executeSaveLink = async (finalUrl: string) => {
    if (!user) return;
    const currentSubject = subjects.find((s) => s.id === subjectId);
    const subjectName = currentSubject ? currentSubject.name : 'General';

    setSaving(true);
    setErrorMessage(null);

    try {
      await createResource({
        userId: user.uid,
        title: title.trim(),
        subjectId,
        subjectName,
        resourceType: 'link',
        fileUrl: finalUrl,
        uploadDate: Date.now(),
        description: description.trim(),
        tags: selectedTags,
        isFavorite: false
      });

      showToast('success', 'Link Added', `"${title}" was saved to your vault.`);
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Error saving link:', err);
      setErrorMessage(err.message || 'Failed to save link.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const formattedUrl = cleanUrl(url);
    if (!isValidUrl(formattedUrl)) {
      setErrorMessage('Please enter a valid website URL (e.g. https://nptel.ac.in/courses/...)');
      return;
    }
    if (!title.trim()) {
      setErrorMessage('Please enter a title for this link.');
      return;
    }
    if (!subjectId) {
      setErrorMessage('Please select a subject.');
      return;
    }

    if (user) {
      const duplicate = await checkDuplicateResource(user.uid, formattedUrl);
      if (duplicate) {
        setDuplicateUrl(formattedUrl);
        return;
      }
    }

    await executeSaveLink(formattedUrl);
  };

  const handleClose = () => {
    setUrl('');
    setTitle('');
    setDescription('');
    setSelectedTags([]);
    setErrorMessage(null);
    setSaving(false);
    onClose();
  };

  return (
    <>
      <div
        id="add-link-modal-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <div
          id="add-link-modal-container"
          className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-900 dark:text-white my-8 animate-in fade-in zoom-in-95"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-850 text-purple-600 dark:text-purple-400">
                <LinkIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Save Study Link</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Add useful articles, video lectures, or reference sites</p>
              </div>
            </div>
            <button
              id="close-add-link-modal-btn"
              onClick={handleClose}
              disabled={saving}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-850 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* URL Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Website URL <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://geeksforgeeks.org/operating-systems/..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm transition"
                />
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Title / Bookmark Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. GeeksforGeeks CPU Scheduling Algorithms"
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm transition"
              />
            </div>

            {/* Subject Dropdown */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Subject <span className="text-rose-500">*</span>
                </label>
                {onOpenCreateSubject && (
                  <button
                    type="button"
                    onClick={onOpenCreateSubject}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Subject</span>
                  </button>
                )}
              </div>
              <select
                required
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm transition cursor-pointer"
              >
                {subjects.length === 0 ? (
                  <option value="">No subjects found. Create one first!</option>
                ) : (
                  subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} {sub.code ? `(${sub.code})` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <TagIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Tags & Exam Markers</span>
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COMMON_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  const isExamTag = tag === '2 Marks' || tag === '16 Marks';
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? isExamTag
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-purple-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Tag */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyDown={handleAddCustomTag}
                  placeholder="Add custom tag (Press Enter)"
                  className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
                <button
                  type="button"
                  disabled={!customTag.trim()}
                  onClick={handleAddCustomTag}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Notes / Context (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this link useful for? Key points or chapters covered..."
                rows={2}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm resize-none transition"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="submit-add-link-btn"
                type="submit"
                disabled={saving || !url.trim() || !title.trim() || subjects.length === 0}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Save Link</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!duplicateUrl}
        title="Duplicate Link"
        message="You have already saved this link URL in your vault. Do you want to save another copy?"
        confirmText="Save Anyway"
        cancelText="Cancel"
        onConfirm={() => {
          if (duplicateUrl) {
            const u = duplicateUrl;
            setDuplicateUrl(null);
            executeSaveLink(u);
          }
        }}
        onCancel={() => setDuplicateUrl(null)}
      />
    </>
  );
}
