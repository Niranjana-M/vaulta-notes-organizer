import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Subject, StudyResource, ActiveTab } from '../../types';
import { isWordDoc, isPdfDoc, isImageDoc } from '../../services/storageService';
import { RecentFilesSection } from './RecentFilesSection';
import {
  FileText,
  FileCode,
  Image as ImageIcon,
  Link as LinkIcon,
  BookMarked,
  Upload,
  Plus,
  ArrowRight,
  Sparkles,
  BookOpen,
  FolderOpen,
  CheckCircle2,
  Bookmark
} from 'lucide-react';

interface DashboardViewProps {
  subjects: Subject[];
  resources: StudyResource[];
  onSelectTab: (tab: ActiveTab) => void;
  onSelectSubject: (subjectId: string) => void;
  onOpenUpload: () => void;
  onOpenAddLink: () => void;
  onOpenCreateSubject: () => void;
  onSeedPresets: () => void;
  onOpenResource: (resource: StudyResource) => void;
  onToggleFavorite: (resource: StudyResource) => void;
  onEditResource: (resource: StudyResource) => void;
  onDeleteResource: (resource: StudyResource) => void;
  onShareResource?: (resource: StudyResource) => void;
}

export function DashboardView({
  subjects,
  resources,
  onSelectTab,
  onSelectSubject,
  onOpenUpload,
  onOpenAddLink,
  onOpenCreateSubject,
  onSeedPresets,
  onOpenResource,
  onToggleFavorite,
  onEditResource,
  onDeleteResource,
  onShareResource
}: DashboardViewProps) {
  const { user, userProfile } = useAuth();

  // Metrics
  const pdfCount = resources.filter(isPdfDoc).length;
  const docCount = resources.filter(isWordDoc).length;
  const imgCount = resources.filter(isImageDoc).length;
  const linkCount = resources.filter((r) => r.resourceType === 'link').length;

  const twoMarkCount = resources.filter(
    (r) => r.tags?.includes('2 Marks') || r.description?.toLowerCase().includes('2 mark')
  ).length;
  const sixteenMarkCount = resources.filter(
    (r) => r.tags?.includes('16 Marks') || r.description?.toLowerCase().includes('16 mark')
  ).length;

  const displayName =
    userProfile?.displayName || user?.email?.split('@')[0] || 'Student';

  return (
    <div id="dashboard-view" className="space-y-6 sm:space-y-8 animate-in fade-in">
      {/* Top Welcome Card */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 sm:p-7 shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-850 text-indigo-700 dark:text-indigo-400 text-xs font-semibold mb-2.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>College Study Hub</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Welcome back, {displayName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
              Your college notes, question banks, 2/16 mark questions, and semester syllabus in one centralized workspace.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              id="dash-upload-btn"
              type="button"
              onClick={onOpenUpload}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Notes</span>
            </button>
            <button
              id="dash-add-link-btn"
              type="button"
              onClick={onOpenAddLink}
              className="px-3.5 py-2 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs sm:text-sm font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <LinkIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Save Link</span>
            </button>
            <button
              type="button"
              onClick={onOpenCreateSubject}
              className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>New Subject</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row (5 Cards) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-0.5">
          <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>Resource Overview</span>
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {resources.length} total resources • {subjects.length} subjects
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* PDFs */}
          <div
            onClick={() => onSelectTab('vault')}
            className="p-4 bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-2xl transition cursor-pointer shadow-xs hover:shadow-md flex items-center gap-3.5 group"
          >
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-850 text-rose-600 dark:text-rose-400 shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{pdfCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">PDF Notes</p>
            </div>
          </div>

          {/* Word Docs */}
          <div
            onClick={() => onSelectTab('vault')}
            className="p-4 bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-2xl transition cursor-pointer shadow-xs hover:shadow-md flex items-center gap-3.5 group"
          >
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-850 text-blue-600 dark:text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{docCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Word Docs</p>
            </div>
          </div>

          {/* Images */}
          <div
            onClick={() => onSelectTab('vault')}
            className="p-4 bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-2xl transition cursor-pointer shadow-xs hover:shadow-md flex items-center gap-3.5 group"
          >
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-850 text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{imgCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Diagrams/Images</p>
            </div>
          </div>

          {/* Links */}
          <div
            onClick={() => onSelectTab('vault')}
            className="p-4 bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-2xl transition cursor-pointer shadow-xs hover:shadow-md flex items-center gap-3.5 group"
          >
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-850 text-purple-600 dark:text-purple-400 shrink-0 group-hover:scale-105 transition-transform">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{linkCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Web Links</p>
            </div>
          </div>

          {/* Total Subjects */}
          <div
            onClick={() => onSelectTab('subjects')}
            className="col-span-2 sm:col-span-1 p-4 bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-2xl transition cursor-pointer shadow-xs hover:shadow-md flex items-center gap-3.5 group"
          >
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-850 text-indigo-600 dark:text-indigo-400 shrink-0 group-hover:scale-105 transition-transform">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{subjects.length}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">My Subjects</p>
            </div>
          </div>
        </div>
      </div>

      {/* College Exam Tag Highlights (2-Marks & 16-Marks) */}
      {(twoMarkCount > 0 || sixteenMarkCount > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div
            onClick={() => onSelectTab('search')}
            className="p-4 bg-amber-50/60 dark:bg-amber-950/30 hover:bg-amber-50 dark:hover:bg-amber-900/40 border border-amber-200/80 dark:border-amber-900/60 rounded-2xl transition cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 flex items-center justify-center font-bold text-xs border border-amber-200 dark:border-amber-800">
                2M
              </div>
              <div>
                <p className="text-sm font-bold text-amber-950 dark:text-amber-200">2 Marks Q&A Bank</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">{twoMarkCount} short answer resources available</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          </div>

          <div
            onClick={() => onSelectTab('search')}
            className="p-4 bg-indigo-50/60 dark:bg-indigo-950/30 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 border border-indigo-200/80 dark:border-indigo-900/60 rounded-2xl transition cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 flex items-center justify-center font-bold text-xs border border-indigo-200 dark:border-indigo-800">
                16M
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-950 dark:text-indigo-200">16 Marks Essays & Derivations</p>
                <p className="text-xs text-indigo-700 dark:text-indigo-400">{sixteenMarkCount} long answer resources available</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
          </div>
        </div>
      )}

      {/* Subjects Section */}
      <div>
        <div className="flex items-center justify-between mb-3 px-0.5">
          <div className="flex items-center gap-2">
            <BookMarked className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">Your Subjects</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenCreateSubject}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Subject</span>
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              type="button"
              onClick={() => onSelectTab('subjects')}
              className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {subjects.length === 0 ? (
          <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-3.5 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-850 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">No Subjects Created Yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Create subjects to organize lecture notes, 2-mark & 16-mark question banks, and semester files.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={onOpenCreateSubject}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Custom Subject</span>
              </button>
              <button
                type="button"
                onClick={onSeedPresets}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Load Suggested College Subjects</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {subjects.slice(0, 6).map((sub) => {
              const subResources = resources.filter((r) => r.subjectId === sub.id);
              return (
                <div
                  key={sub.id}
                  id={`subject-card-${sub.id}`}
                  onClick={() => onSelectSubject(sub.id)}
                  className="p-4 bg-white dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600 rounded-2xl transition-all cursor-pointer group shadow-xs hover:shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {sub.name}
                      </h3>
                      {sub.code && (
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-850 shrink-0">
                          {sub.code}
                        </span>
                      )}
                    </div>
                    {sub.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                        {sub.description}
                      </p>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      {subResources.length} {subResources.length === 1 ? 'Resource' : 'Resources'}
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Files Section */}
      <RecentFilesSection
        resources={resources}
        onOpenResource={onOpenResource}
        onViewAll={() => onSelectTab('vault')}
        onShareResource={onShareResource}
      />
    </div>
  );
}

