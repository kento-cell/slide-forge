import type { AppSettings } from "../types";

const KEY = "slide-forge.settings.v1";

export function loadSettings(): AppSettings | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppSettings;
  } catch {
    return null;
  }
}

export function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore quota */
  }
}

export function clearSettings() {
  localStorage.removeItem(KEY);
}
