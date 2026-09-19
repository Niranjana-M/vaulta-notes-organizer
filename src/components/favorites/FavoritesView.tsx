import React, { useState } from 'react';
import { StudyResource } from '../../types';
import { ResourceCard } from '../resources/ResourceCard';
import { Star, Search, FileText } from 'lucide-react';

interface FavoritesViewProps {
  resources: StudyResource[];
  onOpenResource: (resource: StudyResource) => void;
  onToggleFavorite: (resource: StudyResource) => void;
  onEditResource: (resource: StudyResource) => void;
  onDeleteResource: (resource: StudyResource) => void;
  onShareResource?: (resource: StudyResource) => void;
}

export function FavoritesView({
  resources,
  onOpenResource,
  onToggleFavorite,
  onEditResource,
  onDeleteResource,
  onShareResource
}: FavoritesViewProps) {
  const [filterText, setFilterText] = useState('');

  const favoriteResources = resources.filter((r) => r.isFavorite);

  const filteredFavorites = favoriteResources.filter((res) => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    return (
      res.title.toLowerCase().includes(q) ||
      res.subjectName.toLowerCase().includes(q) ||
      res.fileName?.toLowerCase().includes(q) ||
      res.tags?.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div id="favorites-view" className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Star className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 fill-amber-500" />
            <span>Favorite Resources</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quickly access your starred study material, 2/16 mark questions, and key notes.
          </p>
        </div>

        {/* Search within favorites */}
        {favoriteResources.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search in favorites..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>
        )}
      </div>

      {/* Grid of Favorites */}
      {favoriteResources.length === 0 ? (
        <div className="p-8 sm:p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-850 text-amber-500 mx-auto flex items-center justify-center">
            <Star className="w-6 h-6 fill-amber-400" />
          </div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">No Favorite Resources Yet</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Click the star icon on any PDF, Word document, image, or link to bookmark it here for quick revision.
          </p>
        </div>
      ) : filteredFavorites.length === 0 ? (
        <div className="p-8 sm:p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-2 shadow-xs">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No favorite resources matched "{filterText}".
          </p>
          <button
            type="button"
            onClick={() => setFilterText('')}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold cursor-pointer"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFavorites.map((res) => (
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
