import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://kqgawuyrbyzsimawxrtc.supabase.co';
export const SUPABASE_STORAGE_BUCKET = 'vaulta-files';

/**
 * Validates and normalizes any user-provided URL or env variable into a strict HTTP/HTTPS URL
 */
function normalizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return DEFAULT_SUPABASE_URL;
  }

  let cleaned = rawUrl.trim().replace(/^["']|["']$/g, '');
  if (!cleaned || cleaned === 'undefined' || cleaned === 'null') {
    return DEFAULT_SUPABASE_URL;
  }

  // If user provided a string with embedded http/https (e.g. "Url----https://kqgawuyrbyzsimawxrtc.supabase.co")
  const urlMatch = cleaned.match(/https?:\/\/[^\s"'\s<>]+/i);
  if (urlMatch) {
    cleaned = urlMatch[0];
  } else {
    // Strip common label prefixes e.g. "url:", "project_url="
    cleaned = cleaned.replace(/^(?:url|supabase_url|project_url)[:\s=_-]+/i, '').trim();
    // If user only provided a sub-domain / project ID like "kqgawuyrbyzsimawxrtc"
    if (/^[a-z0-9-]+$/i.test(cleaned)) {
      return `https://${cleaned}.supabase.co`;
    }
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      cleaned = `https://${cleaned}`;
    }
  }

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
  } catch (e) {
    console.warn(`Invalid Supabase URL "${rawUrl}", falling back to default: ${DEFAULT_SUPABASE_URL}`);
  }

  return DEFAULT_SUPABASE_URL;
}

export const SUPABASE_URL = normalizeSupabaseUrl(
  typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_URL : undefined
);

const rawPublishableKey =
  typeof import.meta !== 'undefined'
    ? (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY)
    : '';

export const SUPABASE_PUBLISHABLE_KEY =
  typeof rawPublishableKey === 'string'
    ? rawPublishableKey
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/^(?:key|anon_key|publishable_key)[:\s=_-]+/i, '')
        .trim()
    : '';

// Dummy standard JWT token fallback to prevent client initialization crash if key isn't set yet
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZ2F3dXlyYnl6c2ltYXd4cnRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgzNDAwMDAsImV4cCI6MjAyMzkxNjAwMH0.placeholder';

export function isSupabaseConfigured(): boolean {
  if (!SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY === FALLBACK_ANON_KEY || SUPABASE_PUBLISHABLE_KEY.length < 20) {
    return false;
  }
  if (!SUPABASE_URL || SUPABASE_URL.includes('kqgawuyrbyzsimawxrtc')) {
    return false;
  }
  return true;
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const keyToUse = SUPABASE_PUBLISHABLE_KEY || FALLBACK_ANON_KEY;
    try {
      supabaseInstance = createClient(SUPABASE_URL, keyToUse, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
    } catch (err) {
      console.error('Supabase client creation error:', err);
      // Emergency fallback with default URL and token
      supabaseInstance = createClient(DEFAULT_SUPABASE_URL, FALLBACK_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
    }
  }
  return supabaseInstance;
}

export const supabase = getSupabase();

