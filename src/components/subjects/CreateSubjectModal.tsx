import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PRESET_SUBJECTS, Subject } from '../../types';
import { createSubject, updateSubject } from '../../services/firestoreService';
import { BookMarked, X, Sparkles, Check, AlertCircle } from 'lucide-react';

interface CreateSubjectModalProps {
  isOpen: boolean;
  subjectToEdit?: Subject | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const COLOR_OPTIONS = [
  { name: 'emerald', bg: 'bg-emerald-600', ring: 'ring-emerald-400' },
  { name: 'indigo', bg: 'bg-indigo-600', ring: 'ring-indigo-400' },
  { name: 'amber', bg: 'bg-amber-600', ring: 'ring-amber-400' },
  { name: 'sky', bg: 'bg-sky-600', ring: 'ring-sky-400' },
  { name: 'purple', bg: 'bg-purple-600', ring: 'ring-purple-400' },
  { name: 'rose', bg: 'bg-rose-600', ring: 'ring-rose-400' },
  { name: 'teal', bg: 'bg-teal-600', ring: 'ring-teal-400' },
  { name: 'orange', bg: 'bg-orange-600', ring: 'ring-orange-400' }
];

export function CreateSubjectModal({
  isOpen,
  subjectToEdit,
  onClose,
  onSuccess
}: CreateSubjectModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(subjectToEdit?.name || '');
  const [code, setCode] = useState(subjectToEdit?.code || '');
  const [description, setDescription] = useState(subjectToEdit?.description || '');
  const [color, setColor] = useState(subjectToEdit?.color || 'indigo');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: { name: string; code: string; color: string }) => {
    setName(preset.name);
    setCode(preset.code);
    setColor(preset.color);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) {
      setErrorMessage('Please enter a subject name.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      if (subjectToEdit) {
        await updateSubject(subjectToEdit.id, {
          name: name.trim(),
          code: code.trim(),
          description: description.trim(),
          color
        });
        showToast('success', 'Subject Updated', `"${name}" details updated.`);
      } else {
        await createSubject(user.uid, {
          name: name.trim(),
          code: code.trim(),
          description: description.trim(),
          color
        });
        showToast('success', 'Subject Created', `"${name}" is ready for resources.`);
      }

      if (onSuccess) onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Error saving subject:', err);
      setErrorMessage(err.message || 'Failed to save subject.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setName('');
    setCode('');
    setDescription('');
    setColor('indigo');
    setErrorMessage(null);
    setSaving(false);
    onClose();
  };

  return (
    <div
      id="create-subject-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div
        id="create-subject-modal-container"
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-900 dark:text-white my-8 animate-in fade-in zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-850 text-indigo-600 dark:text-indigo-400">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {subjectToEdit ? 'Edit Subject' : 'Create New Subject'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Organize and group notes by course</p>
            </div>
          </div>
          <button
            id="close-create-subject-modal-btn"
            onClick={handleClose}
            disabled={saving}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset Quick Fill (Only if creating new) */}
        {!subjectToEdit && (
          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Quick College Presets:</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_SUBJECTS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 hover:text-indigo-700 dark:hover:text-indigo-300 text-slate-700 dark:text-slate-200 text-xs rounded-lg border border-slate-200 dark:border-slate-600 shadow-2xs transition cursor-pointer"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-850 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Subject Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Operating Systems"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition"
            />
          </div>

          {/* Subject / Course Code */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Course Code (Optional)
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. CS3451 or EC3352"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition"
            />
          </div>

          {/* Color Tag */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Subject Color Badge
            </label>
            <div className="flex items-center gap-2.5">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setColor(c.name)}
                  className={`w-7 h-7 rounded-full ${c.bg} flex items-center justify-center transition cursor-pointer ${
                    color === c.name ? `ring-2 ${c.ring} ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-110` : 'opacity-70 hover:opacity-100'
                  }`}
                  aria-label={`Select ${c.name} color`}
                >
                  {color === c.name && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Syllabus / Notes (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Semester 4 core subject, professor name, classroom link..."
              rows={2}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm resize-none transition"
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
              id="submit-create-subject-btn"
              type="submit"
              disabled={saving || !name.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{subjectToEdit ? 'Save Changes' : 'Create Subject'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
