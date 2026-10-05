import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'homeedu_supabase_url';
const STORAGE_KEY_PUBLISHABLE = 'homeedu_supabase_publishable_key';
const STORAGE_KEY_LEGACY_ANON = 'homeedu_supabase_anon_key';

export function isProductionEnvironment(): boolean {
  return import.meta.env.PROD === true;
}

export function isDevelopmentEnvironment(): boolean {
  return import.meta.env.DEV === true;
}

/**
 * Resolves the dynamic origin for auth redirects (email confirmation, password recovery, etc.).
 * Always uses the active window.location.origin in the browser, falling back to VITE_APP_URL.
 * Never hardcodes localhost:3000.
 */
export function getAuthRedirectUrl(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  const envUrl = import.meta.env.VITE_APP_URL || import.meta.env.APP_URL || '';
  if (envUrl) {
    return envUrl.startsWith('http') ? envUrl : `https://${envUrl}`;
  }
  return '';
}

/**
 * Validates that a key is safe for browser/client use.
 * Throws an explicit error if a secret or service-role key is detected.
 * Never outputs or logs the key value.
 */
export function validateBrowserApiKey(key: string): void {
  if (!key) return;

  const trimmed = key.trim();

  // Check new-format secret key prefix or secret naming
  if (
    trimmed.startsWith('sb_secret_') ||
    trimmed.toLowerCase().includes('service_role') ||
    trimmed.toLowerCase().includes('secret')
  ) {
    throw new Error(
      'Forbidden use of secret API key in browser: A secret or service-role key cannot be used in client-side code. Please configure VITE_SUPABASE_PUBLISHABLE_KEY with a public publishable key.'
    );
  }

  // Check legacy JWT payload if applicable
  if (trimmed.startsWith('eyJ')) {
    try {
      const parts = trimmed.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload?.role === 'service_role') {
          throw new Error(
            'Forbidden use of secret API key in browser: A service-role JWT cannot be used in client-side code. Please configure VITE_SUPABASE_PUBLISHABLE_KEY with a public publishable key.'
          );
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Forbidden use of secret')) {
        throw err;
      }
    }
  }
}

export function getStoredSupabaseConfig(): { url: string; publishableKey: string } {
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL ? import.meta.env.VITE_SUPABASE_URL : '').trim();
  const envPublishableKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY : '').trim();

  // Always purge legacy anon/secret keys from localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_LEGACY_ANON);
  }

  let storedUrl = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY_URL) || '').trim() : '';
  let storedPublishableKey =
    typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY_PUBLISHABLE) || '').trim() : '';

  // If localStorage contains a key with forbidden secret patterns, immediately purge it
  if (storedPublishableKey) {
    try {
      validateBrowserApiKey(storedPublishableKey);
    } catch {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY_PUBLISHABLE);
        localStorage.removeItem(STORAGE_KEY_URL);
      }
      storedUrl = '';
      storedPublishableKey = '';
    }
  }

  // If the active environment supplies a configured URL and the stored URL diverges from it,
  // sync with the active environment to avoid stale connection caching across project recreation
  if (envUrl && storedUrl && storedUrl !== envUrl && typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_PUBLISHABLE);
    storedUrl = '';
    storedPublishableKey = '';
  }

  const url = storedUrl || envUrl;
  const publishableKey = storedPublishableKey || envPublishableKey;

  return { url, publishableKey };
}

export function saveStoredSupabaseConfig(url: string, publishableKey: string): void {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem(STORAGE_KEY_URL, url.trim());
    else localStorage.removeItem(STORAGE_KEY_URL);

    if (publishableKey) {
      // Validate key before saving
      validateBrowserApiKey(publishableKey);
      localStorage.setItem(STORAGE_KEY_PUBLISHABLE, publishableKey.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_PUBLISHABLE);
    }
  }
}

let clientInstance: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

export function isSupabaseConfigured(): boolean {
  const { url, publishableKey } = getStoredSupabaseConfig();
  const isRealUrl = Boolean(url && url.startsWith('http') && !url.includes('your-project'));
  const isRealKey = Boolean(publishableKey && publishableKey.length > 20 && !publishableKey.includes('...'));

  if (!isRealUrl || !isRealKey) {
    return false;
  }

  try {
    validateBrowserApiKey(publishableKey);
    return true;
  } catch (err) {
    console.error('Supabase configuration error:', err instanceof Error ? err.message : err);
    return false;
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  const { url, publishableKey } = getStoredSupabaseConfig();

  if (!url || !publishableKey) {
    if (isProductionEnvironment()) {
      throw new Error(
        'Supabase configuration is mandatory in production. Please define VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
      );
    }
    return null;
  }

  // Enforce browser key security check
  validateBrowserApiKey(publishableKey);

  if (!isSupabaseConfigured()) {
    if (isProductionEnvironment()) {
      throw new Error(
        'Invalid Supabase configuration in production. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are valid public credentials.'
      );
    }
    return null;
  }

  if (!clientInstance || lastUsedUrl !== url || lastUsedKey !== publishableKey) {
    clientInstance = createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    lastUsedUrl = url;
    lastUsedKey = publishableKey;
  }

  return clientInstance;
}

let connectivityFailed = false;

export function isSupabaseReachable(): boolean {
  return isSupabaseConfigured() && !connectivityFailed;
}

export function markSupabaseConnectivityFailed(failed: boolean = true): void {
  connectivityFailed = failed;
}

export function resetSupabaseConnectivity(): void {
  connectivityFailed = false;
}

