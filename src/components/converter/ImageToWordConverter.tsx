import React, { useState, useRef } from 'react';
import { Subject } from '../../types';
import {
  convertImageToWord,
  downloadConvertedBlob,
  isSupportedImageFile,
  ConvertedResult
} from '../../services/converterService';
import { formatFileSize } from '../../services/storageService';
import { SaveToVaultModal } from './SaveToVaultModal';
import { useToast } from '../../context/ToastContext';
import {
  Upload,
  FileCode,
  Download,
  FolderLock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Loader2,
  X,
  FileText
} from 'lucide-react';

interface ImageToWordConverterProps {
  subjects: Subject[];
  onNavigateToVault?: () => void;
}

export function ImageToWordConverter({
  subjects,
  onNavigateToVault
}: ImageToWordConverterProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [convertedResult, setConvertedResult] = useState<ConvertedResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasCopiedText, setHasCopiedText] = useState(false);

  // Save to Vault Modal
  const [isSaveToVaultOpen, setIsSaveToVaultOpen] = useState(false);

  const handleFileChange = (file: File) => {
    setErrorMessage(null);
    setConvertedResult(null);

    if (!isSupportedImageFile(file)) {
      setErrorMessage(`Unsupported format: "${file.name}". Please upload a JPG, JPEG, PNG, or WEBP image.`);
      return;
    }

    if (file.size === 0) {
      setErrorMessage(`The file "${file.name}" is empty.`);
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setSelectedFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleReset = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    if (convertedResult) {
      URL.revokeObjectURL(convertedResult.previewUrl);
    }
    setSelectedFile(null);
    setImagePreviewUrl(null);
    setConvertedResult(null);
    setErrorMessage(null);
    setIsConverting(false);
    setConversionProgress(0);
  };

  const handleConvert = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select an image file to convert.');
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);
    setConversionProgress(10);
    setStatusMessage('Preparing image...');

    try {
      const result = await convertImageToWord(selectedFile, (pct, status) => {
        setConversionProgress(pct);
        setStatusMessage(status);
      });

      setConvertedResult(result);
      setIsConverting(false);
    } catch (err: any) {
      console.error('[ImageToWordConverter] Conversion failed:', err);
      setIsConverting(false);
      setErrorMessage(err.message || 'Failed to convert image to Word document.');
    }
  };

  const handleDownload = () => {
    if (!convertedResult) return;
    downloadConvertedBlob(convertedResult.blob, convertedResult.filename);
  };

  const handleCopyExtractedText = () => {
    if (!convertedResult?.extractedText) return;
    navigator.clipboard.writeText(convertedResult.extractedText);
    setHasCopiedText(true);
    showToast('info', 'Copied to Clipboard', 'Extracted text was copied to clipboard.');
    setTimeout(() => setHasCopiedText(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Upload Box / Dropzone if no file selected or want to pick new */}
      {!selectedFile && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/20 rounded-2xl p-6 sm:p-8 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3 group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileChange(e.target.files[0]);
                e.target.value = '';
              }
            }}
            className="hidden"
          />

          <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-transform group-hover:scale-110">
            <Upload className="w-6 h-6" />
          </div>

          <div>
            <p className="text-sm font-bold text-slate-800">
              Click to upload an image or document scan
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Supports JPG, JPEG, PNG, and WEBP • Optical Character Recognition (OCR)
            </p>
          </div>

          <button
            type="button"
            className="mt-1 px-4 py-1.5 bg-white border border-slate-200 group-hover:border-blue-200 rounded-xl text-xs font-semibold text-slate-700 group-hover:text-blue-600 shadow-2xs transition pointer-events-none"
          >
            Select Image
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1">
            <p className="font-semibold">Notice</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="p-1 text-rose-500 hover:text-rose-700 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Selected Image Preview & Conversion Controls */}
      {selectedFile && !convertedResult && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Selected Image
            </span>
            <button
              type="button"
              onClick={handleReset}
              disabled={isConverting}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Change Image</span>
            </button>
          </div>

          {/* Image preview card */}
          <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
            {imagePreviewUrl && (
              <div className="w-full sm:w-28 h-28 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                <img
                  src={imagePreviewUrl}
                  alt={selectedFile.name}
                  className="w-full h-full object-contain p-1"
                />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1 text-center sm:text-left">
              <p className="text-xs font-bold text-slate-800 truncate">
                {selectedFile.name}
              </p>
              <p className="text-[11px] text-slate-500">
                Size: {formatFileSize(selectedFile.size)} • Type: {selectedFile.type || 'Image'}
              </p>
              <div className="pt-1 flex flex-wrap gap-2 justify-center sm:justify-start">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                  Client-side OCR
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600">
                  Outputs .docx
                </span>
              </div>
            </div>
          </div>

          {/* Active Conversion Progress Indicator */}
          {isConverting ? (
            <div className="space-y-3 p-4 bg-blue-50/60 border border-blue-100 rounded-xl">
              <div className="flex items-center justify-between text-xs text-blue-900 font-semibold">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  {statusMessage}
                </span>
                <span>{conversionProgress}%</span>
              </div>
              <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${conversionProgress}%` }}
                />
              </div>

              {/* Progress Steps Guide */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[10px] text-slate-500">
                <div className={`p-1.5 rounded-lg border text-center ${conversionProgress >= 10 ? 'bg-blue-100/70 border-blue-200 text-blue-800 font-bold' : 'bg-white/60 border-slate-200'}`}>
                  1. Preparing image
                </div>
                <div className={`p-1.5 rounded-lg border text-center ${conversionProgress >= 25 ? 'bg-blue-100/70 border-blue-200 text-blue-800 font-bold' : 'bg-white/60 border-slate-200'}`}>
                  2. Reading text
                </div>
                <div className={`p-1.5 rounded-lg border text-center ${conversionProgress >= 85 ? 'bg-blue-100/70 border-blue-200 text-blue-800 font-bold' : 'bg-white/60 border-slate-200'}`}>
                  3. Creating Word doc
                </div>
                <div className={`p-1.5 rounded-lg border text-center ${conversionProgress >= 95 ? 'bg-blue-100/70 border-blue-200 text-blue-800 font-bold' : 'bg-white/60 border-slate-200'}`}>
                  4. Almost done
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleConvert}
                disabled={isConverting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <FileCode className="w-4 h-4" />
                <span>Extract Text & Convert to Word</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Success / Result State */}
      {convertedResult && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5 animate-in fade-in duration-200">
          {/* Status Banner */}
          <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-800">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold">Word document created</p>
              <p className="text-[11px] text-emerald-700">
                Text extracted via OCR and packaged into an editable Microsoft Word document (.docx).
              </p>
            </div>
          </div>

          {/* Result Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <FileCode className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {convertedResult.filename}
                </p>
                <p className="text-[11px] text-slate-400">
                  {formatFileSize(convertedResult.blob.size)} • Microsoft Word Document (.docx)
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Word</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSaveToVaultOpen(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <FolderLock className="w-3.5 h-3.5 text-blue-600" />
                <span>Save to Vault</span>
              </button>
            </div>
          </div>

          {/* Extracted Text Content Box */}
          {convertedResult.extractedText && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Extracted Text Preview</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyExtractedText}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  {hasCopiedText ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
              </div>

              <div className="max-h-56 overflow-y-auto p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed select-text">
                {convertedResult.extractedText}
              </div>
            </div>
          )}

          {/* Reset / Convert Another */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Convert Another Image</span>
            </button>
          </div>
        </div>
      )}

      {/* Save To Vault Modal */}
      {isSaveToVaultOpen && convertedResult && (
        <SaveToVaultModal
          isOpen={isSaveToVaultOpen}
          onClose={() => setIsSaveToVaultOpen(false)}
          blob={convertedResult.blob}
          filename={convertedResult.filename}
          resourceType="doc"
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
