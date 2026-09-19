import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StudyResource, Subject } from '../../types';
import { formatFileSize } from '../../services/storageService';
import {
  validateAvatarFile,
  uploadAvatarImage,
  deleteAvatarImage,
  readFileAsDataUrl
} from '../../services/avatarService';
import {
  User as UserIcon,
  Mail,
  ShieldCheck,
  HardDrive,
  FileText,
  FileCode,
  Image as ImageIcon,
  Link as LinkIcon,
  LogOut,
  Camera,
  Trash2,
  AlertCircle,
  Loader2,
  BookMarked
} from 'lucide-react';

interface ProfileViewProps {
  subjects: Subject[];
  resources: StudyResource[];
}

export function ProfileView({ subjects, resources }: ProfileViewProps) {
  const { user, userProfile, logout, updateUserDisplayName, updateUserAvatar } = useAuth();
  const { showToast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [nameInput, setNameInput] = useState(userProfile?.displayName || user?.displayName || '');

  useEffect(() => {
    if (userProfile?.displayName || user?.displayName) {
      setNameInput(userProfile?.displayName || user?.displayName || '');
    }
  }, [userProfile?.displayName, user?.displayName]);

  const currentAvatarUrl =
    userProfile?.photoURL ||
    userProfile?.avatarUrl ||
    user?.photoURL ||
    user?.avatarUrl ||
    null;

  const displayAvatar = previewUrl || currentAvatarUrl;
  const hasUploadedPicture = Boolean(currentAvatarUrl);
  const userInitial =
    userProfile?.displayName?.charAt(0).toUpperCase() ||
    user?.displayName?.charAt(0).toUpperCase() ||
    user?.email?.charAt(0).toUpperCase() ||
    'U';

  const totalBytes = resources.reduce((acc, r) => acc + (r.fileSize || 0), 0);
  const isDoc = (r: StudyResource) =>
    r.resourceType === 'doc' ||
    r.fileName?.toLowerCase().endsWith('.doc') ||
    r.fileName?.toLowerCase().endsWith('.docx');
  const isPdf = (r: StudyResource) =>
    r.resourceType === 'pdf' ||
    r.fileName?.toLowerCase().endsWith('.pdf');
  const isImg = (r: StudyResource) =>
    r.resourceType === 'image' ||
    r.fileName?.toLowerCase().endsWith('.jpg') ||
    r.fileName?.toLowerCase().endsWith('.jpeg') ||
    r.fileName?.toLowerCase().endsWith('.png') ||
    r.fileName?.toLowerCase().endsWith('.webp');
  const isLink = (r: StudyResource) => r.resourceType === 'link';

  const pdfCount = resources.filter(isPdf).length;
  const docCount = resources.filter(isDoc).length;
  const imgCount = resources.filter(isImg).length;
  const linkCount = resources.filter(isLink).length;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again if needed
    e.target.value = '';

    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      setValidationError(validation.error || 'Please select a JPG, PNG, or WEBP image.');
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    setValidationError(null);
    setSelectedFile(file);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPreviewUrl(dataUrl);
    } catch (err) {
      setValidationError('Could not preview selected image.');
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  const triggerFileSelect = () => {
    setValidationError(null);
    fileInputRef.current?.click();
  };

  const handleCancelPreview = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setValidationError(null);
  };

  const handleSaveChanges = async () => {
    if (!user) return;
    setIsSaving(true);
    setValidationError(null);

    try {
      // 1. If a new photo file was picked, upload and update avatar
      if (selectedFile) {
        const downloadUrl = await uploadAvatarImage(user.uid, selectedFile);
        await updateUserAvatar(downloadUrl);
        setSelectedFile(null);
        setPreviewUrl(null);
      }

      // 2. If name was modified, update displayName
      const trimmedName = nameInput.trim();
      const currentName = userProfile?.displayName || user?.displayName || '';
      if (trimmedName && trimmedName !== currentName) {
        await updateUserDisplayName(trimmedName);
      }

      showToast('success', 'Profile Updated', 'Your profile details and picture have been saved.');
    } catch (err: any) {
      console.error('Failed to save profile changes:', err);
      showToast('error', 'Save Failed', err.message || 'Could not save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!user) return;
    setIsRemoving(true);
    setValidationError(null);

    try {
      await deleteAvatarImage(user.uid);
      await updateUserAvatar(null);
      setSelectedFile(null);
      setPreviewUrl(null);
      showToast('success', 'Photo Removed', 'Your profile picture has been removed.');
    } catch (err: any) {
      console.error('Failed to remove photo:', err);
      showToast('error', 'Remove Failed', err.message || 'Could not remove profile picture.');
    } finally {
      setIsRemoving(false);
    }
  };

  const isSaveDisabled =
    isSaving ||
    (!selectedFile &&
      nameInput.trim() === (userProfile?.displayName || user?.displayName || ''));

  return (
    <div id="profile-view" className="space-y-6 max-w-2xl mx-auto animate-in fade-in">
      {/* Hidden File Input for Avatar Selection */}
      <input
        id="avatar-file-input"
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Main Profile Section */}
      <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xs space-y-6">
        {/* Profile Title */}
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Profile
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage your personal profile picture and account information
          </p>
        </div>

        {/* Avatar Section */}
        <div className="flex flex-col items-center justify-center pt-2">
          {/* Circular Avatar Container */}
          <div
            id="avatar-click-target"
            onClick={triggerFileSelect}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                triggerFileSelect();
              }
            }}
            title="Click to select image"
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-800 ring-2 ring-slate-200/80 dark:ring-slate-700 shadow-sm relative group cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] bg-slate-100 dark:bg-slate-800 shrink-0"
          >
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt={userProfile?.displayName || 'Avatar'}
                className="w-full h-full rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white text-4xl font-black shadow-inner select-none">
                {userInitial}
              </div>
            )}

            {/* Hover Camera Overlay */}
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-semibold gap-1">
              <Camera className="w-6 h-6" />
              <span>Change</span>
            </div>
          </div>

          {/* Avatar Action Buttons */}
          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
            {previewUrl ? (
              <div className="flex items-center gap-2">
                <button
                  id="preview-save-btn"
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveChanges}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
                <button
                  id="cancel-preview-btn"
                  type="button"
                  disabled={isSaving}
                  onClick={handleCancelPreview}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : hasUploadedPicture ? (
              <div className="flex items-center gap-2">
                <button
                  id="change-photo-btn"
                  type="button"
                  onClick={triggerFileSelect}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Change Photo</span>
                </button>
                <button
                  id="remove-photo-btn"
                  type="button"
                  disabled={isRemoving}
                  onClick={handleRemovePhoto}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-xl border border-rose-200/80 dark:border-rose-900 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isRemoving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Remove Photo</span>
                </button>
              </div>
            ) : (
              <button
                id="change-photo-btn"
                type="button"
                onClick={triggerFileSelect}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Change Photo</span>
              </button>
            )}
          </div>

          {previewUrl && (
            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-2 font-medium">
              Preview mode — click Save Changes below to apply.
            </p>
          )}

          {/* Validation Error Banner */}
          {validationError && (
            <div
              id="avatar-validation-error"
              className="mt-3 w-full max-w-sm p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-start gap-2 animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}
        </div>

        {/* Profile Fields */}
        <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Name Field */}
          <div>
            <label
              htmlFor="profile-name-input"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Name:
            </label>
            <input
              id="profile-name-input"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Email:
            </label>
            <div className="w-full px-4 py-2.5 bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-xl text-slate-600 dark:text-slate-400 text-sm font-medium flex items-center gap-2 select-all">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{user?.email || 'user@email.com'}</span>
            </div>
          </div>

          {/* Save Changes Button */}
          <div className="pt-2">
            <button
              id="save-profile-btn"
              type="button"
              disabled={isSaveDisabled}
              onClick={handleSaveChanges}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isSaving ? 'Saving Changes...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>

        {/* Security / Private Vault Info */}
        <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-850 rounded-2xl flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-emerald-900 dark:text-emerald-200">
              Private Multi-Tenant Isolation Active
            </p>
            <p className="text-emerald-700 dark:text-emerald-400 leading-relaxed">
              All documents, notes, and study links are cryptographically isolated and linked only to your User ID (
              <span className="font-mono text-[11px] font-semibold text-emerald-900 dark:text-emerald-200">{user?.uid}</span>
              ). No other user has access to your private resources.
            </p>
          </div>
        </div>

        {/* Vault Stats Breakdown */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Vault Storage & Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1">
                <HardDrive className="w-4 h-4" />
                <span className="text-xs font-semibold">Cloud Storage</span>
              </div>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">{formatFileSize(totalBytes)}</p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1">
                <BookMarked className="w-4 h-4" />
                <span className="text-xs font-semibold">Subjects</span>
              </div>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">{subjects.length}</p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-1">
                <FileText className="w-4 h-4" />
                <span className="text-xs font-semibold">PDF Documents</span>
              </div>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">{pdfCount}</p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                <FileCode className="w-4 h-4" />
                <span className="text-xs font-semibold">Word Docs</span>
              </div>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">{docCount}</p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                <ImageIcon className="w-4 h-4" />
                <span className="text-xs font-semibold">Images</span>
              </div>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">{imgCount}</p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                <LinkIcon className="w-4 h-4" />
                <span className="text-xs font-semibold">Web Links</span>
              </div>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">{linkCount}</p>
            </div>
          </div>
        </div>

        {/* Logout Section */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            id="profile-logout-btn"
            type="button"
            onClick={() => logout()}
            className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-850 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>Log Out of Vaulta</span>
          </button>
        </div>
      </div>
    </div>
  );
}
