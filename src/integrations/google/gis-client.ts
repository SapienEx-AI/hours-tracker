// Minimal typings for Google Identity Services. The full library is loaded via
// a <script> tag in index.html; this file declares just what we use.

type GisTokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: 'Bearer';
  error?: string;
  error_description?: string;
};

type GisTokenClient = {
  requestAccessToken(overrideConfig?: { prompt?: '' | 'consent' | 'none' }): void;
};

type GisOauth2 = {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: GisTokenResponse) => void;
    error_callback?: (error: { type: string; message?: string }) => void;
  }): GisTokenClient;
  revoke(accessToken: string, callback?: () => void): void;
};

declare global {
  interface Window {
    google?: { accounts: { oauth2: GisOauth2 } };
  }
}

import { GOOGLE_CLIENT_ID } from './client-id';

export const CALENDAR_READONLY_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const SCOPE = `${CALENDAR_READONLY_SCOPE} ${GMAIL_READONLY_SCOPE}`;
const STORAGE_KEY = 'hours-tracker.google-token';

type StoredToken = { access_token: string; expires_at: number };

function readStored(): StoredToken | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    if (typeof parsed.access_token !== 'string' || typeof parsed.expires_at !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(t: StoredToken): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
}

function clearStored(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function ensureClientIdConfigured(): void {
  if (GOOGLE_CLIENT_ID.startsWith('REPLACE_ME')) {
    throw new Error(
      'Google OAuth client ID is not configured. See docs/architecture/google-calendar-setup.md.',
    );
  }
}

export function isConnected(): boolean {
  const t = readStored();
  return !!t && t.expires_at > Date.now() + 10_000;
}

export function disconnect(): void {
  const t = readStored();
  clearStored();
  if (t && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(t.access_token);
  }
}

export function connect(): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      ensureClientIdConfigured();
    } catch (e) {
      reject(e as Error);
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services library has not loaded yet.'));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) {
          reject(new Error(`Google auth failed: ${resp.error_description ?? resp.error}`));
          return;
        }
        const stored: StoredToken = {
          access_token: resp.access_token,
          expires_at: Date.now() + resp.expires_in * 1000,
        };
        writeStored(stored);
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        reject(new Error(`Google auth error: ${err.type}${err.message ? ` — ${err.message}` : ''}`));
      },
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

export async function getAccessToken(): Promise<string> {
  const stored = readStored();
  if (stored && stored.expires_at > Date.now() + 60_000) return stored.access_token;
  return new Promise((resolve, reject) => {
    try {
      ensureClientIdConfigured();
    } catch (e) {
      reject(e as Error);
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services library has not loaded yet.'));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) {
          clearStored();
          reject(new Error(`Token refresh failed: ${resp.error_description ?? resp.error}`));
          return;
        }
        const next: StoredToken = {
          access_token: resp.access_token,
          expires_at: Date.now() + resp.expires_in * 1000,
        };
        writeStored(next);
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        clearStored();
        reject(new Error(`Silent refresh failed: ${err.type}`));
      },
    });
    client.requestAccessToken({ prompt: '' });
  });
}
