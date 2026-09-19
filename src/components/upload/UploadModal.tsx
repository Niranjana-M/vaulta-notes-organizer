import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Subject, COMMON_TAGS, ResourceType } from '../../types';
import {
  validateFile,
  uploadFileToStorage,
  formatFileSize,
  getResourceTypeFromFileName,
  getMimeTypeFromFileName
} from '../../services/storageService';
import {
  createResource,
  checkDuplicateResource
} from '../../services/firestoreService';
import { ConfirmDialog } from '../common/ConfirmDialog';
import {
  X,
  UploadCloud,
  FileText,
  FileCode,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Plus,
  Tag as TagIcon
} from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  subjects: Subject[];
  defaultSubjectId?: string;
  onClose: () => void;
  onSuccess?: () => void;
  onOpenCreateSubject?: () => void;
}

export function UploadModal({
  isOpen,
  subjects,
  defaultSubjectId,
  onClose,
  onSuccess,
  onOpenCreateSubject
}: UploadModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<ResourceType | null>(null);
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState(defaultSubjectId || (subjects[0]?.id ?? ''));
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');

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

  // Upload Progress & State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cancelUploadRef = useRef<(() => void) | null>(null);

  // Duplicate Check Dialog
  const [duplicateResource, setDuplicateResource] = useState<{ fileName: string } | null>(null);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (file: File) => {
    setErrorMessage(null);
    const validation = validateFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid file');
      return;
    }

    const detected = validation.type || getResourceTypeFromFileName(file.name) || 'doc';
    setSelectedFile(file);
    setFileType(detected);
    if (!title.trim()) {
      // Default title from file name without extension
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      setTitle(baseName);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

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

  const executeUpload = async (fileToUpload: File) => {
    if (!user) return;
    const targetSubjectId = subjectId || (defaultSubjectId && subjects.some(s => s.id === defaultSubjectId) ? defaultSubjectId : subjects[0]?.id);
    if (!targetSubjectId) {
      setErrorMessage('Please select a subject for this resource.');
      return;
    }

    const currentSubject = subjects.find((s) => s.id === targetSubjectId);
    const subjectName = currentSubject ? currentSubject.name : 'General';

    console.log('[UploadModal] Starting upload flow for file:', {
      fileName: fileToUpload.name,
      fileSize: fileToUpload.size,
      fileType: fileToUpload.type,
      userId: user.uid,
      targetSubjectId,
      subjectName
    });

    setIsUploading(true);
    setUploadProgress(0);
    setStatusText('Preparing upload...');
    setErrorMessage(null);

    try {
      // 1. Storage Upload
      const uploadHandler = uploadFileToStorage(user.uid, targetSubjectId, fileToUpload, (pct) => {
        setUploadProgress(pct);
        if (pct < 100) {
          setStatusText(`Uploading... ${pct}%`);
        } else {
          setStatusText('Finalizing storage...');
        }
      });

      cancelUploadRef.current = uploadHandler.cancel;

      const { downloadUrl, storagePath, mimeType, isLocalFallback, supabaseResult } = await uploadHandler.promise;

      // 2. Save Metadata to Firestore
      setStatusText('Saving resource metadata...');
      const detectedType = getResourceTypeFromFileName(fileToUpload.name) || fileType || 'doc';
      const accurateMime = mimeType || getMimeTypeFromFileName(fileToUpload.name, fileToUpload.type);

      const createdDoc = await createResource({
        userId: user.uid,
        title: title.trim() || fileToUpload.name,
        subjectId: targetSubjectId,
        subjectName,
        resourceType: detectedType,
        fileName: fileToUpload.name,
        fileUrl: downloadUrl,
        storagePath: storagePath || '',
        fileSize: fileToUpload.size || 0,
        mimeType: accurateMime,
        uploadDate: Date.now(),
        description: description.trim() || '',
        tags: selectedTags || [],
        isFavorite: false
      });

      // 3. Trigger and await resource refresh
      setStatusText('Refreshing resources...');
      let refreshResultStatus = 'success';
      try {
        if (onSuccess) {
          await onSuccess();
        }
      } catch (refErr: any) {
        refreshResultStatus = `refresh warning: ${refErr.message}`;
      }

      // Detailed Console Debug Information
      console.log(`%c[UPLOAD DEBUG]
filename: ${fileToUpload.name}
file type: ${detectedType}
mime type: ${accurateMime}
size: ${fileToUpload.size} bytes (${(fileToUpload.size / (1024 * 1024)).toFixed(2)} MB)
userId: ${user.uid}
subjectId: ${targetSubjectId} (${subjectName})
storage path: ${storagePath}
Supabase upload result: ${supabaseResult || (isLocalFallback ? 'Local IndexedDB' : 'Supabase Storage')}
Firestore resource ID: ${createdDoc.id}
resource type: ${detectedType}
refresh result: ${refreshResultStatus}`, 'color: #4f46e5; font-weight: bold;');

      setStatusText('Upload successful!');
      showToast(
        'success',
        'Document uploaded successfully',
        `"${title.trim() || fileToUpload.name}" is now available in ${subjectName}.`
      );

      handleClose();
    } catch (err: any) {
      console.error('[UploadModal] Upload Error:', err);
      const isCancelled = err.message?.includes('canceled') || err.name === 'AbortError';
      if (!isCancelled) {
        setErrorMessage(err.message || 'Upload failed. Please try again.');
        showToast('error', 'Upload Failed', err.message || 'Error uploading file.');
      }
    } finally {
      setIsUploading(false);
      cancelUploadRef.current = null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Please select a file to upload.');
      return;
    }
    if (!subjectId) {
      setErrorMessage('Please select or create a subject first.');
      return;
    }

    // Duplicate Check
    if (user) {
      const existing = await checkDuplicateResource(user.uid, selectedFile.name);
      if (existing) {
        setPendingUploadFile(selectedFile);
        setDuplicateResource({ fileName: selectedFile.name });
        return;
      }
    }

    await executeUpload(selectedFile);
  };

  const handleDuplicateConfirm = async () => {
    if (pendingUploadFile) {
      const file = pendingUploadFile;
      setDuplicateResource(null);
      setPendingUploadFile(null);
      await executeUpload(file);
    }
  };

  const handleClose = () => {
    if (isUploading && cancelUploadRef.current) {
      cancelUploadRef.current();
    }
    setSelectedFile(null);
    setFileType(null);
    setTitle('');
    setDescription('');
    setSelectedTags([]);
    setUploadProgress(0);
    setIsUploading(false);
    setErrorMessage(null);
    onClose();
  };

  return (
    <>
      <div
        id="upload-modal-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <div
          id="upload-modal-container"
          className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-900 dark:text-white my-8 animate-in fade-in zoom-in-95"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-850 text-indigo-600 dark:text-indigo-400">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Upload Study Resource</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">PDF, Word docs (.doc/.docx), or Images</p>
              </div>
            </div>
            <button
              id="close-upload-modal-btn"
              onClick={handleClose}
              disabled={isUploading}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition disabled:opacity-30 cursor-pointer"
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
            {/* File Dropzone */}
            {!selectedFile ? (
              <div
                id="file-dropzone"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/30 rounded-2xl p-6 text-center transition cursor-pointer flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group-hover:bg-indigo-600 group-hover:text-white text-slate-500 dark:text-slate-400 shadow-2xs flex items-center justify-center transition">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Click to browse or drag & drop file here
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Supported: PDF, DOC, DOCX, JPG, PNG, WEBP (Max 50MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-indigo-100/70 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-850 text-indigo-600 dark:text-indigo-400 shrink-0">
                    {fileType === 'pdf' && <FileText className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
                    {fileType === 'doc' && <FileCode className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                    {fileType === 'image' && <ImageIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatFileSize(selectedFile.size)} • {fileType?.toUpperCase()}
                    </p>
                  </div>
                </div>
                {!isUploading && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setFileType(null);
                    }}
                    className="text-xs text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 font-semibold px-2.5 py-1 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 shadow-2xs cursor-pointer"
                  >
                    Change
                  </button>
                )}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Resource Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isUploading}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Unit 2 Transducer Notes or 16 Mark Answers"
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition"
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
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Subject</span>
                  </button>
                )}
              </div>
              <select
                required
                disabled={isUploading || subjects.length === 0}
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition cursor-pointer"
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

            {/* Tags & Exam Markers (2 Marks, 16 Marks, etc.) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <TagIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
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
                      disabled={isUploading}
                      onClick={() => toggleTag(tag)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? isExamTag
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Tag Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  disabled={isUploading}
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyDown={handleAddCustomTag}
                  placeholder="Add custom tag (Press Enter)"
                  className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <button
                  type="button"
                  disabled={isUploading || !customTag.trim()}
                  onClick={handleAddCustomTag}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Optional Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Notes / Description (Optional)
              </label>
              <textarea
                disabled={isUploading}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Unit number, lecturer notes, topic highlights..."
                rows={2}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm resize-none transition"
              />
            </div>

            {/* Progress Bar (during upload) */}
            {isUploading && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-indigo-600 dark:text-indigo-400">{statusText}</span>
                  <span className="text-slate-900 dark:text-white font-mono">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-200 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isUploading}
                onClick={handleClose}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="submit-upload-btn"
                type="submit"
                disabled={isUploading || !selectedFile || subjects.length === 0}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Start Upload</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Duplicate File Prompt Modal */}
      <ConfirmDialog
        isOpen={!!duplicateResource}
        title="Duplicate File Detected"
        message={`A resource with the file name "${duplicateResource?.fileName}" already exists in your vault. Do you want to upload it again as a separate copy?`}
        confirmText="Yes, Upload Again"
        cancelText="Cancel"
        onConfirm={handleDuplicateConfirm}
        onCancel={() => {
          setDuplicateResource(null);
          setPendingUploadFile(null);
        }}
      />
    </>
  );
}
