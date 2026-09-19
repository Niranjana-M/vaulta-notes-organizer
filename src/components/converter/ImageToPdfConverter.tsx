import React, { useState, useRef, useEffect } from 'react';
import { Subject, StudyResource } from '../../types';
import {
  convertImagesToPdf,
  downloadConvertedBlob,
  isSupportedImageFile,
  ConvertedResult
} from '../../services/converterService';
import { formatFileSize } from '../../services/storageService';
import { SaveToVaultModal } from './SaveToVaultModal';
import { PdfViewerModal } from '../viewers/PdfViewerModal';
import { useToast } from '../../context/ToastContext';
import {
  Upload,
  FileImage,
  ArrowUp,
  ArrowDown,
  Trash2,
  FileText,
  Download,
  Eye,
  FolderLock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  X
} from 'lucide-react';

interface SelectedImageItem {
  id: string;
  file: File;
  previewUrl: string;
}

interface ImageToPdfConverterProps {
  subjects: Subject[];
  onNavigateToVault?: () => void;
}

export function ImageToPdfConverter({
  subjects,
  onNavigateToVault
}: ImageToPdfConverterProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const [images, setImages] = useState<SelectedImageItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [convertedResult, setConvertedResult] = useState<ConvertedResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Preview State (using existing PdfViewerModal with in-memory resource)
  const [previewResource, setPreviewResource] = useState<StudyResource | null>(null);
  const previewBlobUrlRef = useRef<string | null>(null);

  // Save to Vault Modal
  const [isSaveToVaultOpen, setIsSaveToVaultOpen] = useState(false);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
    };
  }, []);

  const handleFilesSelected = (files: FileList | File[]) => {
    setErrorMessage(null);
    const newItems: SelectedImageItem[] = [];
    const rejectedNames: string[] = [];

    Array.from(files).forEach((file) => {
      if (!isSupportedImageFile(file)) {
        rejectedNames.push(file.name);
        return;
      }
      if (file.size === 0) {
        rejectedNames.push(`${file.name} (empty file)`);
        return;
      }

      newItems.push({
        id: 'img_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
        file,
        previewUrl: URL.createObjectURL(file)
      });
    });

    if (rejectedNames.length > 0) {
      setErrorMessage(
        `Some files were skipped because they are not supported images (JPG, JPEG, PNG, WEBP) or are empty: ${rejectedNames.join(', ')}`
      );
    }

    if (newItems.length > 0) {
      setImages((prev) => [...prev, ...newItems]);
      // Reset prior conversion result when new files are added
      if (convertedResult) {
        setConvertedResult(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
    setErrorMessage(null);
    setConvertedResult(null);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setImages((prev) => {
      const updated = [...prev];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
    setConvertedResult(null);
  };

  const handleMoveDown = (index: number) => {
    if (index >= images.length - 1) return;
    setImages((prev) => {
      const updated = [...prev];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
    setConvertedResult(null);
  };

  const handleClearAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    if (convertedResult) {
      URL.revokeObjectURL(convertedResult.previewUrl);
    }
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    setPreviewResource(null);
    setImages([]);
    setConvertedResult(null);
    setErrorMessage(null);
    setIsConverting(false);
  };

  const handlePreviewPdf = () => {
    if (!convertedResult?.blob) {
      showToast('error', 'Preview Error', 'Unable to preview this PDF. Please try downloading it.');
      return;
    }

    try {
      // 1. Create a temporary object URL directly from the generated PDF Blob using URL.createObjectURL(pdfBlob)
      const pdfUrl = URL.createObjectURL(convertedResult.blob);
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
      }
      previewBlobUrlRef.current = pdfUrl;

      // 2. Build lightweight temporary in-memory resource for the existing PDF viewer
      const tempResource: StudyResource & { blob?: Blob } = {
        id: `preview-converted-${Date.now()}`,
        userId: 'local',
        title: convertedResult.filename || 'generated_images.pdf',
        subjectId: 'converter',
        subjectName: 'Converted Document',
        resourceType: 'pdf',
        fileName: convertedResult.filename || 'generated_images.pdf',
        fileUrl: pdfUrl,
        fileSize: convertedResult.blob.size,
        mimeType: 'application/pdf',
        uploadDate: Date.now(),
        tags: ['Converted'],
        isFavorite: false,
        blob: convertedResult.blob
      };

      setPreviewResource(tempResource);
    } catch (err) {
      console.error('[ImageToPdfConverter] Preview generation error:', err);
      showToast('error', 'Preview Error', 'Unable to preview this PDF. Please try downloading it.');
    }
  };

  const handleClosePreview = () => {
    setPreviewResource(null);
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
  };

  const handleConvert = async () => {
    if (images.length === 0) {
      setErrorMessage('Please add at least one image to convert.');
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);
    setConversionProgress(5);
    setStatusMessage('Starting conversion...');

    try {
      const rawFiles = images.map((img) => img.file);
      const result = await convertImagesToPdf(rawFiles, (pct, status) => {
        setConversionProgress(pct);
        setStatusMessage(status);
      });

      setConvertedResult(result);
      setIsConverting(false);
    } catch (err: any) {
      console.error('[ImageToPdfConverter] Conversion failed:', err);
      setErrorMessage(err.message || 'Failed to convert images to PDF. Please check your files and try again.');
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (!convertedResult) return;
    downloadConvertedBlob(convertedResult.blob, convertedResult.filename);
  };

  return (
    <div className="space-y-6">
      {/* Upload Box / Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 rounded-2xl p-6 sm:p-8 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3 group"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => {
            if (e.target.files) {
              handleFilesSelected(e.target.files);
              e.target.value = '';
            }
          }}
          className="hidden"
        />

        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center transition-transform group-hover:scale-110">
          <Upload className="w-6 h-6" />
        </div>

        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Click to upload or drag & drop images
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Supports JPG, JPEG, PNG, and WEBP • Single or multiple images
          </p>
        </div>

        <button
          type="button"
          className="mt-1 px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group-hover:border-indigo-200 dark:group-hover:border-indigo-600 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shadow-2xs transition pointer-events-none"
        >
          Select Images
        </button>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-850 rounded-2xl text-rose-800 dark:text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <div className="flex-1">
            <p className="font-semibold">Conversion Note</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="p-1 text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Selected Images List */}
      {images.length > 0 && !convertedResult && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Selected Images ({images.length})
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Will be compiled in top-to-bottom order
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add More</span>
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            </div>
          </div>

          {/* List of images with ordering controls */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {images.map((img, index) => (
              <div
                key={img.id}
                className="flex items-center justify-between gap-3 p-2.5 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-xl transition"
              >
                {/* Thumbnail & Name */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="w-5 text-center text-xs font-bold text-slate-400 dark:text-slate-500">
                    {index + 1}
                  </span>
                  <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                    <img
                      src={img.previewUrl}
                      alt={img.file.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {img.file.name}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      {formatFileSize(img.file.size)}
                    </p>
                  </div>
                </div>

                {/* Reorder and Delete controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0 || isConverting}
                    title="Move Up"
                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === images.length - 1 || isConverting}
                    title="Move Down"
                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(img.id)}
                    disabled={isConverting}
                    title="Remove Image"
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition disabled:opacity-30 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Conversion Button & Active Progress */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
            {isConverting ? (
              <div className="space-y-2 p-3.5 bg-indigo-50/60 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 rounded-xl">
                <div className="flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200 font-semibold">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                    {statusMessage}
                  </span>
                  <span>{conversionProgress}%</span>
                </div>
                <div className="w-full h-2 bg-indigo-100 dark:bg-indigo-900/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
                    style={{ width: `${conversionProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleConvert}
                  disabled={isConverting || images.length === 0}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>
                    Convert {images.length} {images.length === 1 ? 'Image' : 'Images'} to PDF
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success / Result State */}
      {convertedResult && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5 animate-in fade-in duration-200">
          {/* Header Status */}
          <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold">Conversion completed</p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                Your PDF has been generated client-side with aspect ratios preserved.
              </p>
            </div>
          </div>

          {/* Converted File Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-750">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                  {convertedResult.filename}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-400">
                  {formatFileSize(convertedResult.blob.size)} • {convertedResult.pageCount || 1}{' '}
                  {(convertedResult.pageCount || 1) === 1 ? 'page' : 'pages'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePreviewPdf}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Preview PDF</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSaveToVaultOpen(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <FolderLock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Save to Vault</span>
              </button>
            </div>
          </div>

          {/* Reset / Convert Another */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Convert More Images</span>
            </button>
          </div>
        </div>
      )}

      {/* PDF Interactive Preview Modal using existing PdfViewerModal */}
      {previewResource && (
        <PdfViewerModal
          resource={previewResource}
          pdfBlob={convertedResult?.blob}
          onClose={handleClosePreview}
        />
      )}

      {/* Save To Vault Modal */}
      {isSaveToVaultOpen && convertedResult && (
        <SaveToVaultModal
          isOpen={isSaveToVaultOpen}
          onClose={() => setIsSaveToVaultOpen(false)}
          blob={convertedResult.blob}
          filename={convertedResult.filename}
          resourceType="pdf"
          subjects={subjects}
          onSuccess={() => {
            if (onNavigateToVault) {
              onNavigateToVault();
            }
          }}
        />
      )}
    </div>
  );
}
