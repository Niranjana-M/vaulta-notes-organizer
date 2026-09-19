import React, { useState } from 'react';
import { StudyResource } from '../../types';
import { formatFileSize, downloadResourceFile, isWordDoc, isPdfDoc, isImageDoc } from '../../services/storageService';
import {
  FileText,
  FileCode,
  Image as ImageIcon,
  Link as LinkIcon,
  Star,
  Download,
  MoreVertical,
  Edit2,
  Trash2,
  ExternalLink,
  Eye,
  Calendar,
  Share2
} from 'lucide-react';

interface ResourceCardProps {
  key?: React.Key;
  resource: StudyResource;
  onOpen: (resource: StudyResource) => void;
  onToggleFavorite: (resource: StudyResource) => void;
  onEdit: (resource: StudyResource) => void;
  onDelete: (resource: StudyResource) => void;
  onShare?: (resource: StudyResource) => void;
}

export function ResourceCard({
  resource,
  onOpen,
  onToggleFavorite,
  onEdit,
  onDelete,
  onShare
}: ResourceCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const getBadge = () => {
    const fileNameLower = (resource.fileName || resource.title || '').toLowerCase();

    if (isPdfDoc(resource)) {
      return {
        icon: <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />,
        bg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300',
        label: 'PDF'
      };
    }
    if (isWordDoc(resource)) {
      return {
        icon: <FileCode className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
        bg: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
        label: fileNameLower.endsWith('.doc') ? 'DOC' : 'DOCX'
      };
    }
    if (isImageDoc(resource)) {
      return {
        icon: <ImageIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
        bg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
        label: 'IMAGE'
      };
    }
    return {
      icon: <LinkIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />,
      bg: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300',
      label: 'LINK'
    };
  };

  const badge = getBadge();
  const formattedDate = new Date(resource.uploadDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });

  return (
    <div
      id={`resource-card-${resource.id}`}
      className="group relative bg-white dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 shadow-xs hover:shadow-md"
    >
      {/* Top Header inside Card */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          {/* File Type Badge & Subject Name */}
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-bold tracking-wider ${badge.bg}`}
            >
              {badge.icon}
              <span>{badge.label}</span>
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate max-w-[130px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
              {resource.subjectName}
            </span>
          </div>

          {/* Top-Right Quick Actions: Star, Share & Menu */}
          <div className="flex items-center gap-1 relative shrink-0">
            {/* Quick Share Button */}
            {onShare && (
              <button
                id={`share-btn-${resource.id}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(resource);
                }}
                className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Share Resource"
                aria-label="Share Resource"
              >
                <Share2 className="w-4 h-4" />
              </button>
            )}

            <button
              id={`fav-btn-${resource.id}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(resource);
              }}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                resource.isFavorite
                  ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                  : 'text-slate-400 dark:text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={resource.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-label={resource.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star
                className={`w-4 h-4 ${resource.isFavorite ? 'fill-amber-400' : ''}`}
              />
            </button>

            {/* Menu Trigger */}
            <div className="relative">
              <button
                id={`menu-trigger-${resource.id}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                aria-label="Resource options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                    }}
                  />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-30 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onOpen(resource);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2 font-medium"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>{resource.resourceType === 'link' ? 'Visit Link' : 'Open / View'}</span>
                    </button>
                    {onShare && (
                      <button
                        id={`menu-share-btn-${resource.id}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onShare(resource);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Share Resource</span>
                      </button>
                    )}
                    {resource.resourceType !== 'link' && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          try {
                            await downloadResourceFile(resource);
                          } catch (err: any) {
                            console.error('[ResourceCard] Download error:', err);
                            alert(err.message || 'Failed to download file.');
                          }
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Download File</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onEdit(resource);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      <span>Edit Details</span>
                    </button>
                    <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onDelete(resource);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Resource</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Title */}
        <h3
          id={`resource-title-${resource.id}`}
          onClick={() => onOpen(resource)}
          className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 cursor-pointer leading-snug mb-1.5"
          title={resource.title}
        >
          {resource.title}
        </h3>

        {/* Description / snippet if any */}
        {resource.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3 leading-relaxed">
            {resource.description}
          </p>
        )}
      </div>

      {/* Tags & Bottom Metadata Bar */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        {/* Tags */}
        {resource.tags && resource.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {resource.tags.map((tag) => {
              const isExamTag = tag === '2 Marks' || tag === '16 Marks';
              return (
                <span
                  key={tag}
                  className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                    isExamTag
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        )}

        {/* Bottom Bar: Meta & Open Button */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              <span>{formattedDate}</span>
            </span>
            {resource.fileSize ? (
              <>
                <span>•</span>
                <span>{formatFileSize(resource.fileSize)}</span>
              </>
            ) : null}
          </div>

          <button
            id={`open-btn-${resource.id}`}
            type="button"
            onClick={() => onOpen(resource)}
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
          >
            <span>{resource.resourceType === 'link' ? 'Visit' : 'Open'}</span>
            {resource.resourceType === 'link' ? (
              <ExternalLink className="w-3 h-3" />
            ) : (
              <Eye className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

