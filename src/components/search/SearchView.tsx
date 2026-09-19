import React, { useState, useMemo } from 'react';
import { StudyResource, COMMON_TAGS } from '../../types';
import { ResourceCard } from '../resources/ResourceCard';
import { Search, Tag as TagIcon, FileText, Check, Sparkles } from 'lucide-react';

interface SearchViewProps {
  resources: StudyResource[];
  onOpenResource: (resource: StudyResource) => void;
  onToggleFavorite: (resource: StudyResource) => void;
  onEditResource: (resource: StudyResource) => void;
  onDeleteResource: (resource: StudyResource) => void;
  onShareResource?: (resource: StudyResource) => void;
}

export function SearchView({
  resources,
  onOpenResource,
  onToggleFavorite,
  onEditResource,
  onDeleteResource,
  onShareResource
}: SearchViewProps) {
  const [queryText, setQueryText] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const searchResults = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return resources.filter((res) => {
      // Tag filter
      if (selectedTag && (!res.tags || !res.tags.includes(selectedTag))) {
        return false;
      }

      // Query filter
      if (!q) return true;

      const titleMatch = res.title.toLowerCase().includes(q);
      const fileMatch = res.fileName?.toLowerCase().includes(q);
      const subjectMatch = res.subjectName.toLowerCase().includes(q);
      const descMatch = res.description?.toLowerCase().includes(q);
      const tagsMatch = res.tags?.some((t) => t.toLowerCase().includes(q));

      return titleMatch || fileMatch || subjectMatch || descMatch || tagsMatch;
    });
  }, [resources, queryText, selectedTag]);

  return (
    <div id="search-view" className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <Search className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 dark:text-indigo-400" />
          <span>Fast Resource Search</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Instant search across titles, file names, subjects, tags (2/16 Marks), and notes.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs space-y-4">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-indigo-600 dark:text-indigo-400 pointer-events-none" />
          <input
            id="global-search-input"
            type="text"
            autoFocus
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Type anything (e.g. 'Operating Systems', '2 Marks', 'Unit 3', 'Transducer', '.docx')..."
            className="w-full pl-12 pr-16 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
          {queryText && (
            <button
              type="button"
              onClick={() => setQueryText('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Quick Tag Pills */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 text-[11px] mr-1">
            <TagIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Search by Tag:</span>
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

      {/* Results Count & Clear */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <span>
          Found <strong className="text-slate-900 dark:text-slate-100 font-bold">{searchResults.length}</strong> matching{' '}
          {searchResults.length === 1 ? 'resource' : 'resources'}
        </span>
        {(queryText || selectedTag) && (
          <button
            type="button"
            onClick={() => {
              setQueryText('');
              setSelectedTag(null);
            }}
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold cursor-pointer"
          >
            Reset Search
          </button>
        )}
      </div>

      {/* Results Grid */}
      {searchResults.length === 0 ? (
        <div className="p-8 sm:p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 mx-auto flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No matching resources found for "{queryText || selectedTag}".
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Try searching for a different keyword, subject name, or tag.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {searchResults.map((res) => (
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
