import React, { useState } from 'react';
import { Subject, StudyResource } from '../../types';
import { ImageToPdfConverter } from './ImageToPdfConverter';
import { ImageToWordConverter } from './ImageToWordConverter';
import {
  RefreshCw,
  FileText,
  FileCode,
  ShieldCheck,
  Zap,
  HardDrive
} from 'lucide-react';

interface FileConverterViewProps {
  subjects: Subject[];
  onOpenResource?: (resource: StudyResource) => void;
  onNavigateToVault?: () => void;
}

type ConversionType = 'image-to-pdf' | 'image-to-word';

export function FileConverterView({
  subjects,
  onOpenResource,
  onNavigateToVault
}: FileConverterViewProps) {
  const [selectedType, setSelectedType] = useState<ConversionType>('image-to-pdf');

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Page Header */}
      <div className="text-center space-y-2 pt-2 sm:pt-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-850 text-indigo-600 dark:text-indigo-400 shadow-2xs">
          <RefreshCw className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          File Converter
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Convert your files easily right inside your browser
        </p>
      </div>

      {/* Conversion Type Selection Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="mb-3 text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Select Conversion Type
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Option 1: Image -> PDF */}
          <button
            type="button"
            onClick={() => setSelectedType('image-to-pdf')}
            className={`flex items-start gap-3.5 p-4 rounded-xl border text-left transition cursor-pointer relative ${
              selectedType === 'image-to-pdf'
                ? 'bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-600 dark:border-indigo-500 ring-2 ring-indigo-600/10'
                : 'bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                selectedType === 'image-to-pdf'
                  ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-200'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <FileText className="w-5 h-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  🖼️ Image → PDF
                </span>
                {selectedType === 'image-to-pdf' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                Combine single or multiple images into a clean, formatted PDF document.
              </p>
              <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
                JPG, PNG, WEBP • Page reordering
              </div>
            </div>
          </button>

          {/* Option 2: Image -> Word */}
          <button
            type="button"
            onClick={() => setSelectedType('image-to-word')}
            className={`flex items-start gap-3.5 p-4 rounded-xl border text-left transition cursor-pointer relative ${
              selectedType === 'image-to-word'
                ? 'bg-blue-50/50 dark:bg-blue-950/40 border-blue-600 dark:border-blue-500 ring-2 ring-blue-600/10'
                : 'bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                selectedType === 'image-to-word'
                  ? 'bg-blue-600 text-white shadow-xs shadow-blue-200'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <FileCode className="w-5 h-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  🖼️ Image → Word
                </span>
                {selectedType === 'image-to-word' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                Extract readable text from an image into an editable Microsoft Word (.docx) file.
              </p>
              <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
                Client-side OCR • Paragraph preservation
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Active Converter Workspace */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs">
        {selectedType === 'image-to-pdf' ? (
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Image to PDF Converter
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Convert single or multiple images into a single downloadable PDF
                </p>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg">
                jsPDF Engine
              </span>
            </div>
            <ImageToPdfConverter
              subjects={subjects}
              onNavigateToVault={onNavigateToVault}
            />
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Image to Word (.docx) Converter
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Extract text from scanned notes or diagrams into an editable Word document
                </p>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg">
                Tesseract OCR + docx
              </span>
            </div>
            <ImageToWordConverter
              subjects={subjects}
              onNavigateToVault={onNavigateToVault}
            />
          </div>
        )}
      </div>

      {/* Feature Highlights / Trust badging */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">100% Client-Side</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Files never leave your browser</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
          <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">Instant Download</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Works on mobile & desktop</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
          <HardDrive className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">Vault Integration</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Save directly to your subjects</p>
          </div>
        </div>
      </div>
    </div>
  );
}
