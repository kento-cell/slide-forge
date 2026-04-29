import type { AppSettings } from "../types";

const KEY = "slide-forge.settings.v1";

const MODEL_MIGRATIONS: Record<string, string> = {
  "gemini-1.5-flash": "gemini-2.5-flash",
  "gemini-1.5-pro": "gemini-2.5-pro",
  "llama-3.1-70b-versatile": "llama-3.3-70b-versatile",
  "claude-3-5-sonnet-latest": "claude-sonnet-4-20250514",
  "claude-3-5-sonnet-20241022": "claude-sonnet-4-20250514",
  "claude-3-5-sonnet-20240620": "claude-sonnet-4-20250514",
};

export function loadSettings(): AppSettings | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppSettings;
    return normalizeSettings(parsed);
  } catch {
    return null;
  }
}

export function saveSettings(s: AppSettings) {
  try {
    // Defensive: strip apiKey before persisting to localStorage.
    // Provider keys live in the OS keychain (see src/lib/secrets.ts);
    // letting them sneak into localStorage even briefly would defeat
    // the migration. The runtime ProviderConfig still carries apiKey
    // in memory while the app is open.
    const sanitized: AppSettings = {
      ...s,
      provider: {
        id: s.provider.id,
        ...(s.provider.model ? { model: s.provider.model } : {}),
        ...(s.provider.endpoint ? { endpoint: s.provider.endpoint } : {}),
      },
    };
    localStorage.setItem(KEY, JSON.stringify(sanitized));
  } catch {
    /* ignore quota */
  }
}

export function clearSettings() {
  localStorage.removeItem(KEY);
}

function normalizeSettings(settings: AppSettings): AppSettings {
  const model = settings.provider.model;
  if (!model) return settings;
  const migrated = MODEL_MIGRATIONS[model];
  if (!migrated) return settings;
  return {
    ...settings,
    provider: {
      ...settings.provider,
      model: migrated,
    },
  };
}
