/**
 * Utility functions for Vaulta Share Resource feature.
 */

export function getShareIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    // 1. Check pathname: /shared/<shareId> (supporting root or subpaths)
    const pathname = window.location.pathname || '';
    const matchPath = pathname.match(/(?:^|\/)shared\/([^/?#]+)/i);
    if (matchPath && matchPath[1]) {
      return decodeURIComponent(matchPath[1].trim()).replace(/\/+$/, '');
    }

    // 2. Check hash: #/shared/<shareId> or #shared/<shareId>
    const hash = window.location.hash || '';
    const matchHash = hash.match(/(?:^|#|\/)shared\/([^/?#]+)/i);
    if (matchHash && matchHash[1]) {
      return decodeURIComponent(matchHash[1].trim()).replace(/\/+$/, '');
    }

    // 3. Check search query parameter: ?shared=<shareId> or ?share=<shareId>
    const search = window.location.search || '';
    const params = new URLSearchParams(search);
    const paramShareId = params.get('shared') || params.get('share');
    if (paramShareId) {
      return paramShareId.trim();
    }
  } catch (err) {
    console.warn('[Share] Error parsing share ID from URL:', err);
  }

  return null;
}

export function buildShareUrl(shareId: string): string {
  if (typeof window === 'undefined') {
    return `/shared/${shareId}`;
  }
  const origin = window.location.origin;
  return `${origin}/shared/${encodeURIComponent(shareId)}`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    console.warn('[Share] navigator.clipboard failed, attempting fallback...', e);
  }

  // Fallback for iframe / unsupported browsers
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('[Share] Fallback copy failed:', err);
    return false;
  }
}
