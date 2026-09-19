import React, { useState } from 'react';
import { Subject, StudyResource, ResourceType } from '../../types';
import { isWordDoc, isPdfDoc, isImageDoc } from '../../services/storageService';
import { ResourceCard } from '../resources/ResourceCard';
import {
  BookMarked,
  Plus,
  ArrowLeft,
  Upload,
  Link as LinkIcon,
  Edit2,
  Trash2,
  Filter,
  Sparkles,
  BookOpen,
  Tag as TagIcon
} from 'lucide-react';

interface SubjectsViewProps {
  subjects: Subject[];
  resources: StudyResource[];
  selectedSubjectId: string | null;
  onSelectSubject: (subjectId: string | null) => void;
  onOpenCreateSubject: () => void;
  onOpenEditSubject: (subject: Subject) => void;
  onDeleteSubject: (subject: Subject) => void;
  onSeedPresets: () => void;
  onOpenUploadForSubject: (subjectId: string) => void;
  onOpenAddLinkForSubject: (subjectId: string) => void;
  onOpenResource: (resource: StudyResource) => void;
  onToggleFavorite: (resource: StudyResource) => void;
  onEditResource: (resource: StudyResource) => void;
  onDeleteResource: (resource: StudyResource) => void;
  onShareResource?: (resource: StudyResource) => void;
}

export function SubjectsView({
  subjects,
  resources,
  selectedSubjectId,
  onSelectSubject,
  onOpenCreateSubject,
  onOpenEditSubject,
  onDeleteSubject,
  onSeedPresets,
  onOpenUploadForSubject,
  onOpenAddLinkForSubject,
  onOpenResource,
  onToggleFavorite,
  onEditResource,
  onDeleteResource,
  onShareResource
}: SubjectsViewProps) {
  const [typeFilter, setTypeFilter] = useState<ResourceType | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const activeSubject = subjects.find((s) => s.id === selectedSubjectId);

  // If a subject is selected, show its detail view
  if (activeSubject) {
    const subjectResources = resources.filter((r) => {
      if (r.subjectId !== activeSubject.id) return false;
      if (typeFilter !== 'all') {
        if ((typeFilter === 'doc' || (typeFilter as string) === 'word' || (typeFilter as string) === 'docx') && !isWordDoc(r)) return false;
        if (typeFilter === 'pdf' && !isPdfDoc(r)) return false;
        if (typeFilter === 'image' && !isImageDoc(r)) return false;
        if (typeFilter === 'link' && r.resourceType !== 'link') return false;
      }
      if (selectedTag && (!r.tags || !r.tags.includes(selectedTag))) return false;
      return true;
    });

    const allSubjectTags = Array.from(
      new Set(
        resources
          .filter((r) => r.subjectId === activeSubject.id)
          .flatMap((r) => r.tags || [])
      )
    );

    return (
      <div id="subject-detail-view" className="space-y-6 animate-in fade-in">
        {/* Back and Subject Header Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <button
                id="back-to-subjects-btn"
                type="button"
                onClick={() => onSelectSubject(null)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition cursor-pointer shrink-0 mt-0.5 sm:mt-0"
                title="Back to All Subjects"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {activeSubject.name}
                  </h1>
                  {activeSubject.code && (
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-850">
                      {activeSubject.code}
                    </span>
                  )}
                </div>
                {activeSubject.description && (
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                    {activeSubject.description}
                  </p>
                )}
              </div>
            </div>

            {/* Subject Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onOpenUploadForSubject(activeSubject.id)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload to Subject</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAddLinkForSubject(activeSubject.id)}
                className="px-3 py-2 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-850 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <LinkIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Add Link</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenEditSubject(activeSubject)}
                className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                title="Edit Subject"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onDeleteSubject(activeSubject)}
                className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                title="Delete Subject"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Toolbar (Type & Tags) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
          {/* Resource Type Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 sm:pb-0">
            {(['all', 'pdf', 'doc', 'image', 'link'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-xl font-semibold capitalize transition cursor-pointer ${
                  typeFilter === t
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {t === 'all' ? 'All Types' : t === 'doc' ? 'Word Docs' : t}
              </button>
            ))}
          </div>

          {/* Tags in Subject */}
          {allSubjectTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 text-[11px]">
                <TagIcon className="w-3 h-3 text-slate-400" />
                <span>Tag:</span>
              </span>
              {selectedTag && (
                <button
                  type="button"
                  onClick={() => setSelectedTag(null)}
                  className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Clear ({selectedTag})
                </button>
              )}
              {allSubjectTags.map((tag) => {
                const isExam = tag === '2 Marks' || tag === '16 Marks';
                const isCurrent = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(isCurrent ? null : tag)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      isCurrent
                        ? isExam
                          ? 'bg-amber-600 text-white'
                          : 'bg-indigo-600 text-white'
                        : isExam
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-850 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Resources Grid */}
        {subjectResources.length === 0 ? (
          <div className="p-8 sm:p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-3 shadow-xs">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No resources found for this filter in {activeSubject.name}.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Upload PDF notes, Word question banks, diagrams, or helpful video links.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => onOpenUploadForSubject(activeSubject.id)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                Upload Resource
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjectResources.map((res) => (
              <ResourceCard
                key={res.id}
                resource={res}
                onOpen={onOpenResource}
                onToggleFavorite={onToggleFavorite}
                onEdit={onEditResource}
                onDelete={onDeleteResource}
                onShare={onShareResource}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // All Subjects Overview Mode
  return (
    <div id="subjects-list-view" className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <BookMarked className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Course Subjects</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Group notes, 2-mark & 16-mark question banks, and syllabus topics by subject.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {subjects.length === 0 && (
            <button
              type="button"
              onClick={onSeedPresets}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Suggested Subjects</span>
            </button>
          )}
          <button
            id="create-subject-top-btn"
            type="button"
            onClick={onOpenCreateSubject}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Subject</span>
          </button>
        </div>
      </div>

      {/* Grid of Subjects */}
      {subjects.length === 0 ? (
        <div className="p-8 sm:p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-850 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">No Subjects Configured</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Create your subjects (e.g. Operating Systems, IoT, Digital Electronics, Data Structures) or initialize common college courses.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenCreateSubject}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Subject</span>
            </button>
            <button
              type="button"
              onClick={onSeedPresets}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Load Preset College Subjects</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((sub) => {
            const subResources = resources.filter((r) => r.subjectId === sub.id);
            const pdfs = subResources.filter(isPdfDoc).length;
            const docs = subResources.filter(isWordDoc).length;
            const imgs = subResources.filter(isImageDoc).length;
            const links = subResources.filter((r) => r.resourceType === 'link').length;

            return (
              <div
                key={sub.id}
                id={`subject-item-${sub.id}`}
                className="p-5 bg-white dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600 rounded-2xl transition-all shadow-xs hover:shadow-md flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />
                      <h3
                        onClick={() => onSelectSubject(sub.id)}
                        className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors cursor-pointer truncate"
                      >
                        {sub.name}
                      </h3>
                    </div>
                    {sub.code && (
                      <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-850 shrink-0">
                        {sub.code}
                      </span>
                    )}
                  </div>

                  {sub.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                      {sub.description}
                    </p>
                  )}

                  {/* Resource breakdown chips */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mb-4 flex-wrap">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{subResources.length} Total</span>
                    <span>•</span>
                    <span>{pdfs} PDF</span>
                    <span>•</span>
                    <span>{docs} Word</span>
                    <span>•</span>
                    <span>{links} Link</span>
                  </div>
                </div>

                {/* Subject Bottom Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenEditSubject(sub)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                      title="Edit Subject"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSubject(sub)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                      title="Delete Subject"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectSubject(sub.id)}
                    className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-850 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Open Subject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

