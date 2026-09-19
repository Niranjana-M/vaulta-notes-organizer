import React, { useState } from 'react';
import { StudyResource, Subject, ResourceType, COMMON_TAGS } from '../../types';
import { isWordDoc, isPdfDoc, isImageDoc } from '../../services/storageService';
import { ResourceCard } from '../resources/ResourceCard';
import {
  FolderLock,
  Filter,
  ArrowUpDown,
  Upload,
  Link as LinkIcon,
  Tag as TagIcon,
  Search,
  Check,
  FileText
} from 'lucide-react';

interface VaultViewProps {
  resources: StudyResource[];
  subjects: Subject[];
  onOpenUpload: () => void;
  onOpenAddLink: () => void;
  onOpenResource: (resource: StudyResource) => void;
  onToggleFavorite: (resource: StudyResource) => void;
  onEditResource: (resource: StudyResource) => void;
  onDeleteResource: (resource: StudyResource) => void;
  onShareResource?: (resource: StudyResource) => void;
}

export function VaultView({
  resources,
  subjects,
  onOpenUpload,
  onOpenAddLink,
  onOpenResource,
  onToggleFavorite,
  onEditResource,
  onDeleteResource,
  onShareResource
}: VaultViewProps) {
  const [selectedType, setSelectedType] = useState<ResourceType | 'all'>('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title' | 'size'>('newest');

  const filteredResources = resources.filter((res) => {
    // Type
    if (selectedType !== 'all') {
      if ((selectedType === 'doc' || (selectedType as string) === 'word' || (selectedType as string) === 'docx') && !isWordDoc(res)) return false;
      if (selectedType === 'pdf' && !isPdfDoc(res)) return false;
      if (selectedType === 'image' && !isImageDoc(res)) return false;
      if (selectedType === 'link' && res.resourceType !== 'link') return false;
    }
    // Subject
    if (selectedSubjectId !== 'all' && res.subjectId !== selectedSubjectId) return false;
    // Tag
    if (selectedTag && (!res.tags || !res.tags.includes(selectedTag))) return false;
    // Search text
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchTitle = res.title.toLowerCase().includes(q);
      const matchFile = res.fileName?.toLowerCase().includes(q);
      const matchSub = res.subjectName.toLowerCase().includes(q);
      const matchDesc = res.description?.toLowerCase().includes(q);
      const matchTag = res.tags?.some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchFile && !matchSub && !matchDesc && !matchTag) return false;
    }
    return true;
  });

  // Sort logic
  const sortedResources = [...filteredResources].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return (b.uploadDate || 0) - (a.uploadDate || 0);
      case 'oldest':
        return (a.uploadDate || 0) - (b.uploadDate || 0);
      case 'title':
        return a.title.localeCompare(b.title);
      case 'size':
        return (b.fileSize || 0) - (a.fileSize || 0);
      default:
        return 0;
    }
  });

  const clearFilters = () => {
    setSelectedType('all');
    setSelectedSubjectId('all');
    setSelectedTag(null);
    setSearchFilter('');
    setSortBy('newest');
  };

  const hasActiveFilters =
    selectedType !== 'all' ||
    selectedSubjectId !== 'all' ||
    selectedTag !== null ||
    searchFilter.trim() !== '';

  return (
    <div id="vault-view" className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <FolderLock className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Study Vault</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Browse, search, and manage all your uploaded PDFs, Word docs, images, and links.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenAddLink}
            className="px-3.5 py-2 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-850 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <LinkIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Save Link</span>
          </button>
          <button
            type="button"
            onClick={onOpenUpload}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload File</span>
          </button>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
        {/* Top filter row: Search + Subject dropdown + Sort */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Quick Filter Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter by title, tags, or description..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-medium cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Subject Filter Dropdown */}
          <div className="w-full md:w-48 shrink-0">
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
            >
              <option value="all">All Subjects ({subjects.length})</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="w-full md:w-44 shrink-0 flex items-center gap-1.5">
            <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0 hidden md:block" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title">Title (A-Z)</option>
              <option value="size">Largest Size</option>
            </select>
          </div>
        </div>

        {/* Resource Type Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 sm:pb-0">
            {(['all', 'pdf', 'doc', 'image', 'link'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition capitalize cursor-pointer ${
                  selectedType === type
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {type === 'all'
                  ? `All (${resources.length})`
                  : type === 'doc'
                  ? 'Word Docs'
                  : type}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Tag Filters Row */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 text-[11px] mr-1">
            <TagIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Filter Tag:</span>
          </span>
          {COMMON_TAGS.map((tag) => {
            const isSelected = selectedTag === tag;
            const isExam = tag === '2 Marks' || tag === '16 Marks';
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(isSelected ? null : tag)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? isExam
                      ? 'bg-amber-600 text-white'
                      : 'bg-indigo-600 text-white'
                    : isExam
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-850 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {isSelected && <Check className="w-3 h-3" />}
                <span>{tag}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <span>
          Showing <strong className="text-slate-900 dark:text-slate-100 font-bold">{sortedResources.length}</strong> of{' '}
          {resources.length} resources
        </span>
      </div>

      {/* Resource Grid */}
      {sortedResources.length === 0 ? (
        <div className="p-8 sm:p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 mx-auto flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No resources found.</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'Try resetting the filters or searching for different keywords.'
              : 'Upload your notes, question papers, or study links to get started.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedResources.map((res) => (
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
