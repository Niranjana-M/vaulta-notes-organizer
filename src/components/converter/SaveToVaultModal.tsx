import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Subject, StudyResource } from '../../types';
import { formatFileSize, uploadFileToStorage } from '../../services/storageService';
import { createResource } from '../../services/firestoreService';
import { useToast } from '../../context/ToastContext';
import {
  X,
  FolderLock,
  FileText,
  FileCode,
  CheckCircle2,
  Loader2,
  BookMarked
} from 'lucide-react';

interface SaveToVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  blob: Blob;
  filename: string;
  resourceType: 'pdf' | 'doc';
  subjects: Subject[];
  onSuccess?: () => void;
}

export function SaveToVaultModal({
  isOpen,
  onClose,
  blob,
  filename,
  resourceType,
  subjects,
  onSuccess
}: SaveToVaultModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [title, setTitle] = useState(() => {
    const dotIndex = filename.lastIndexOf('.');
    return dotIndex > 0 ? filename.substring(0, dotIndex) : filename;
  });

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    return subjects.length > 0 ? subjects[0].id : '';
  });

  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMsg('You must be logged in to save resources.');
      return;
    }

    if (!title.trim()) {
      setErrorMsg('Please enter a title for the resource.');
      return;
    }

    const targetSubject = subjects.find((s) => s.id === selectedSubjectId);
    const subjectName = targetSubject?.name || 'General';

    setIsSaving(true);
    setErrorMsg(null);
    setProgressText('Uploading to storage...');

    try {
      // Create File from Blob
      const fileToUpload = new File([blob], filename, {
        type: resourceType === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      // 1. Upload to storage
      const uploadHandler = uploadFileToStorage(
        user.uid,
        selectedSubjectId || undefined,
        fileToUpload,
        (pct) => {
          setProgressText(`Uploading file... ${pct}%`);
        }
      );

      const { downloadUrl, storagePath, mimeType } = await uploadHandler.promise;

      // 2. Save metadata to Firestore
      setProgressText('Saving to your Vault...');
      await createResource({
        userId: user.uid,
        title: title.trim(),
        subjectId: selectedSubjectId || '',
        subjectName,
        resourceType,
        fileName: filename,
        fileUrl: downloadUrl,
        storagePath: storagePath || '',
        fileSize: blob.size,
        mimeType: mimeType || (resourceType === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
        uploadDate: Date.now(),
        description: description.trim() || `Converted file from File Converter`,
        tags: ['Converted'],
        isFavorite: false
      });

      showToast('success', 'Saved to Vault', `"${title.trim()}" was added to your library.`);
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      console.error('[SaveToVaultModal] Error saving converted resource:', err);
      setErrorMsg(err.message || 'Failed to save to Vault. Please try again.');
      setIsSaving(false);
    }
  };

  return (
    <div
      id="save-to-vault-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <FolderLock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Save to Vault</h3>
              <p className="text-[11px] text-slate-500">Store converted file in your study library</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
          {/* File Info pill */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            {resourceType === 'pdf' ? (
              <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <FileCode className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800 truncate">{filename}</p>
              <p className="text-[11px] text-slate-400">
                {formatFileSize(blob.size)} • {resourceType.toUpperCase()} Document
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Title input */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Document Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSaving}
              placeholder="e.g., Biology Chapter 4 Notes"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
              required
            />
          </div>

          {/* Subject selector */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Select Subject</label>
            {subjects.length > 0 ? (
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                disabled={isSaving}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} {sub.code ? `(${sub.code})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-center gap-2">
                <BookMarked className="w-4 h-4 shrink-0 text-amber-600" />
                <span>No subjects found. This file will be saved under "General".</span>
              </div>
            )}
          </div>

          {/* Optional description */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving}
              placeholder="e.g., Converted from mobile scans"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            />
          </div>

          {/* Progress state */}
          {isSaving && (
            <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 text-xs">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>{progressText}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save to Vault</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
