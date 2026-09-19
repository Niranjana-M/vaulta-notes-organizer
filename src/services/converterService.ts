import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { recognize } from 'tesseract.js';

export interface ConvertedResult {
  blob: Blob;
  filename: string;
  previewUrl: string;
  mimeType: string;
  extractedText?: string;
  pageCount?: number;
}

const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
];

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Validate whether a file is a supported image format
 */
export function isSupportedImageFile(file: File): boolean {
  if (!file) return false;
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();

  const matchesMime = SUPPORTED_IMAGE_TYPES.includes(mime);
  const matchesExt = SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));

  return matchesMime || matchesExt;
}

/**
 * Helper to load an image file into an HTMLImageElement safely
 */
function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (file.size === 0) {
      reject(new Error(`The file "${file.name}" is empty (0 bytes).`));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        reject(new Error(`Image "${file.name}" could not be rendered.`));
      } else {
        resolve(img);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image "${file.name}". The file may be corrupt or an unsupported format.`));
    };

    img.src = objectUrl;
  });
}

/**
 * Draw an image to an offscreen canvas to guarantee clean RGB data and handle any format (WEBP, PNG, JPG)
 */
function imageToJpegDataUrl(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create 2D canvas context for image processing.');
  }

  // Draw white background in case image is transparent PNG or WEBP
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Convert one or multiple images into a single professional PDF
 */
export async function convertImagesToPdf(
  files: File[],
  onProgress?: (pct: number, status: string) => void
): Promise<ConvertedResult> {
  if (!files || files.length === 0) {
    throw new Error('Please select at least one image to convert.');
  }

  onProgress?.(5, 'Validating images...');

  // 1. Validate all files
  for (const file of files) {
    if (!isSupportedImageFile(file)) {
      throw new Error(`Unsupported image format: "${file.name}". Only JPG, JPEG, PNG, and WEBP are supported.`);
    }
    if (file.size === 0) {
      throw new Error(`File "${file.name}" is empty.`);
    }
  }

  // Standard A4 dimensions in points (72 points/inch)
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;
  const MARGIN = 20; // clean 20pt margin around the page

  let pdf: jsPDF | null = null;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const currentStepPct = Math.round(10 + (i / files.length) * 80);
    onProgress?.(currentStepPct, `Processing image ${i + 1} of ${files.length} ("${file.name}")...`);

    const img = await loadImageElement(file);
    const jpegDataUrl = imageToJpegDataUrl(img);

    const isLandscape = img.naturalWidth > img.naturalHeight;
    const pageWidth = isLandscape ? A4_HEIGHT : A4_WIDTH;
    const pageHeight = isLandscape ? A4_WIDTH : A4_HEIGHT;

    // Calculate fitted dimensions preserving aspect ratio
    const maxWidth = pageWidth - MARGIN * 2;
    const maxHeight = pageHeight - MARGIN * 2;
    const scale = Math.min(maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);

    const renderWidth = Math.round(img.naturalWidth * scale);
    const renderHeight = Math.round(img.naturalHeight * scale);
    const posX = Math.round((pageWidth - renderWidth) / 2);
    const posY = Math.round((pageHeight - renderHeight) / 2);

    if (i === 0) {
      pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'pt',
        format: 'a4'
      });
      pdf.addImage(jpegDataUrl, 'JPEG', posX, posY, renderWidth, renderHeight, undefined, 'FAST');
    } else if (pdf) {
      pdf.addPage('a4', isLandscape ? 'landscape' : 'portrait');
      pdf.addImage(jpegDataUrl, 'JPEG', posX, posY, renderWidth, renderHeight, undefined, 'FAST');
    }
  }

  if (!pdf) {
    throw new Error('PDF generation failed: No pages could be generated.');
  }

  onProgress?.(95, 'Finalizing PDF document...');

  const pdfBlob = pdf.output('blob');
  const previewUrl = URL.createObjectURL(pdfBlob);

  // Filename resolution: original image name if 1 image, or converted_images.pdf
  let filename = 'converted_images.pdf';
  if (files.length === 1) {
    const originalName = files[0].name;
    const lastDotIndex = originalName.lastIndexOf('.');
    const baseName = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName;
    filename = `${baseName}.pdf`;
  }

  onProgress?.(100, 'Conversion completed');

  return {
    blob: pdfBlob,
    filename,
    previewUrl,
    mimeType: 'application/pdf',
    pageCount: files.length
  };
}

/**
 * Convert an image containing text into an editable Word (.docx) document using OCR
 */
export async function convertImageToWord(
  file: File,
  onProgress?: (pct: number, status: string) => void
): Promise<ConvertedResult> {
  if (!file) {
    throw new Error('Please select an image to convert.');
  }

  if (!isSupportedImageFile(file)) {
    throw new Error(`Unsupported image format: "${file.name}". Only JPG, JPEG, PNG, and WEBP are supported.`);
  }

  if (file.size === 0) {
    throw new Error(`The file "${file.name}" is empty.`);
  }

  onProgress?.(10, 'Preparing image...');

  // Verify image can be decoded and loaded
  const img = await loadImageElement(file);

  onProgress?.(25, 'Reading text...');

  // Use client-side OCR via Tesseract.js
  let recognizedText = '';
  try {
    const ocrResult = await recognize(file, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
          const pct = Math.min(Math.round(25 + m.progress * 55), 80);
          onProgress?.(pct, `Reading text... ${Math.round(m.progress * 100)}%`);
        } else if (m.status === 'loading tesseract core') {
          onProgress?.(15, 'Preparing OCR engine...');
        } else if (m.status === 'initializing api') {
          onProgress?.(20, 'Reading text...');
        }
      }
    });

    recognizedText = ocrResult?.data?.text || '';
  } catch (ocrErr: any) {
    console.error('[ConverterService] Tesseract OCR failed:', ocrErr);
    throw new Error(ocrErr.message || 'Optical character recognition (OCR) failed to process the image.');
  }

  // Check if readable text was extracted
  const trimmedText = recognizedText.trim();
  if (!trimmedText || trimmedText.length === 0) {
    throw new Error('No readable text was detected in this image.');
  }

  onProgress?.(85, 'Creating Word document...');

  // Build clean DOCX paragraphs preserving line breaks and basic paragraph structure
  const lines = recognizedText.split(/\r?\n/);
  const docxParagraphs: Paragraph[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0) {
      // Empty line for paragraph spacing
      docxParagraphs.push(
        new Paragraph({
          spacing: { after: 120 }
        })
      );
    } else {
      docxParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line,
              font: 'Calibri',
              size: 22 // 11pt font
            })
          ],
          spacing: { after: 120 }
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docxParagraphs
      }
    ]
  });

  onProgress?.(95, 'Almost done...');

  let docxBlob: Blob;
  try {
    docxBlob = await Packer.toBlob(doc);
  } catch (packerErr: any) {
    console.error('[ConverterService] DOCX Packer failed:', packerErr);
    throw new Error(packerErr.message || 'Failed to generate .docx file.');
  }

  const previewUrl = URL.createObjectURL(docxBlob);

  // Filename resolution: original image name with .docx
  const originalName = file.name;
  const lastDotIndex = originalName.lastIndexOf('.');
  const baseName = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName;
  const filename = `${baseName}.docx`;

  onProgress?.(100, 'Word document created');

  return {
    blob: docxBlob,
    filename,
    previewUrl,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extractedText: trimmedText
  };
}

/**
 * Universal safe browser Blob downloader compatible with desktop, mobile, and webviews
 */
export function downloadConvertedBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  // Clean up object URL safely after download initiates
  setTimeout(() => {
    try {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    } catch {}
  }, 2000);
}
