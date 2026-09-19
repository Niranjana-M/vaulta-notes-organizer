import React from 'react';
import { StudyResource } from '../../types';
import { isWordDoc, isPdfDoc, isImageDoc, formatFileSize } from '../../services/storageService';
import {
  FileText,
  FileCode,
  Image as ImageIcon,
  Link as LinkIcon,
  Clock,
  ArrowRight,
  ExternalLink,
  Eye,
  Calendar,
  HardDrive,
  Share2
} from 'lucide-react';

interface RecentFilesSectionProps {
  resources: StudyResource[];
  onOpenResource: (resource: StudyResource) => void;
  onViewAll: () => void;
  onShareResource?: (resource: StudyResource) => void;
}

export function RecentFilesSection({
  resources,
  onOpenResource,
  onViewAll,
  onShareResource
}: RecentFilesSectionProps) {
  // Sort by newest first using uploadDate (or createdAt fallback) and take up to 5
  const recentFiles = [...resources]
    .sort((a, b) => {
      const dateA = a.uploadDate || (a as any).createdAt || 0;
      const dateB = b.uploadDate || (b as any).createdAt || 0;
      return dateB - dateA;
    })
    .slice(0, 5);

  const getFileDetails = (resource: StudyResource) => {
    const fileNameLower = (resource.fileName || resource.title || '').toLowerCase();

    if (isPdfDoc(resource)) {
      return {
        icon: <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
        iconBg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200/80 dark:border-rose-850',
        badgeBg: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800',
        typeLabel: 'PDF',
        openLabel: 'Open',
        isOpenFile: true
      };
    }

    if (isWordDoc(resource)) {
      const label = fileNameLower.endsWith('.doc') ? 'DOC' : 'DOCX';
      return {
        icon: <FileCode className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
        iconBg: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200/80 dark:border-blue-850',
        badgeBg: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800',
        typeLabel: label,
        openLabel: 'Open',
        isOpenFile: true
      };
    }

    if (isImageDoc(resource)) {
      let extLabel = 'Image';
      if (fileNameLower.endsWith('.png')) extLabel = 'PNG';
      else if (fileNameLower.endsWith('.jpg') || fileNameLower.endsWith('.jpeg')) extLabel = 'JPEG';
      else if (fileNameLower.endsWith('.webp')) extLabel = 'WEBP';

      return {
        icon: <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
        iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/80 dark:border-emerald-850',
        badgeBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800',
        typeLabel: extLabel,
        openLabel: 'Open',
        isOpenFile: true
      };
    }

    // Default to Link
    return {
      icon: <LinkIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
      iconBg: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200/80 dark:border-purple-850',
      badgeBg: 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-800',
      typeLabel: 'Link',
      openLabel: 'Visit',
      isOpenFile: false
    };
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Recently';
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div id="recent-files-section" className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
            Recent Files
          </h2>
        </div>
        <button
          id="recent-files-view-all-btn"
          type="button"
          onClick={onViewAll}
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer group"
        >
          <span>View All →</span>
        </button>
      </div>

      {/* Empty State or Recent Files Grid */}
      {recentFiles.length === 0 ? (
        <div
          id="recent-files-empty-state"
          className="p-8 sm:p-10 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl text-center space-y-2.5 shadow-xs"
        >
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 text-slate-400 dark:text-slate-500 mx-auto flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Your recent files will appear here.
          </p>
        </div>
      ) : (
        <div
          id="recent-files-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5"
        >
          {recentFiles.map((res) => {
            const details = getFileDetails(res);
            const dateStr = formatDate(res.uploadDate || (res as any).createdAt);
            const hasFileSize =
              res.resourceType !== 'link' &&
              typeof res.fileSize === 'number' &&
              res.fileSize > 0;

            return (
              <div
                key={res.id}
                id={`recent-file-card-${res.id}`}
                onClick={() => onOpenResource(res)}
                className="group relative bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-850/60 border border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600 rounded-2xl p-4 sm:p-4.5 flex flex-col justify-between transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer"
              >
                <div>
                  {/* Top Metadata Line: Type Icon, File Type Badge, Subject */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Icon */}
                      <div
                        className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${details.iconBg}`}
                      >
                        {details.icon}
                      </div>

                      {/* File Type Badge */}
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${details.badgeBg}`}
                      >
                        {details.typeLabel}
                      </span>
                    </div>

                    {/* Subject */}
                    <span
                      title={res.subjectName}
                      className="text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 truncate max-w-[130px]"
                    >
                      {res.subjectName || 'General'}
                    </span>
                  </div>

                  {/* Resource Title */}
                  <h3
                    title={res.title}
                    className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 leading-snug mb-1"
                  >
                    {res.title || res.fileName || 'Untitled'}
                  </h3>
                </div>

                {/* Bottom Row: Date added, File size (if available), Open/Visit button */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2 text-[11px] min-w-0">
                    {/* Date added */}
                    <span className="flex items-center gap-1 shrink-0" title={`Added: ${dateStr}`}>
                      <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      <span>{dateStr}</span>
                    </span>

                    {/* File Size if available */}
                    {hasFileSize && (
                      <>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span
                          className="flex items-center gap-1 truncate"
                          title={`File size: ${formatFileSize(res.fileSize)}`}
                        >
                          <HardDrive className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          <span>{formatFileSize(res.fileSize)}</span>
                        </span>
                      </>
                    )}
                  </div>

                  {/* Actions: Share & Open / Visit Button */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {onShareResource && (
                      <button
                        id={`recent-share-btn-${res.id}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onShareResource(res);
                        }}
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer shrink-0"
                        title="Share Resource"
                        aria-label="Share Resource"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      id={`recent-open-btn-${res.id}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenResource(res);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 transition cursor-pointer shrink-0"
                    >
                      <span>{details.openLabel}</span>
                      {details.isOpenFile ? (
                        <Eye className="w-3 h-3" />
                      ) : (
                        <ExternalLink className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
