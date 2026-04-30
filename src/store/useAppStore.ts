import { create } from "zustand";
import type { AppSettings, Deck, PackId, ProviderConfig, Screen, ThemeId } from "../types";
import { loadSettings, saveSettings } from "../lib/storage";

const DEFAULT_SETTINGS: AppSettings = {
  provider: { id: "offline" },
  theme: "navy",
  pack: "consulting",
  setupDone: false,
};

interface State {
  screen: Screen;
  settings: AppSettings;
  prompt: string;
  promptTouched: boolean;
  deck: Deck | null;
  rawMarkdown: string;
  generating: boolean;
  error: string | null;
  setScreen: (s: Screen) => void;
  setProvider: (p: ProviderConfig) => void;
  setTheme: (t: ThemeId) => void;
  setPack: (p: PackId) => void;
  finishSetup: () => void;
  resetSetup: () => void;
  setPrompt: (text: string, touched: boolean) => void;
  resetPrompt: () => void;
  setDeck: (deck: Deck | null, raw: string) => void;
  setGenerating: (b: boolean) => void;
  setError: (e: string | null) => void;
}

const initial = loadSettings() ?? DEFAULT_SETTINGS;

export const useAppStore = create<State>((set, get) => ({
  screen: initial.setupDone ? "main" : "wizard",
  settings: initial,
  prompt: "",
  promptTouched: false,
  deck: null,
  rawMarkdown: "",
  generating: false,
  error: null,
  setScreen: (s) => set({ screen: s }),
  setProvider: (p) => {
    const next = { ...get().settings, provider: p };
    saveSettings(next);
    set({ settings: next });
  },
  setTheme: (t) => {
    const next = { ...get().settings, theme: t };
    saveSettings(next);
    set({ settings: next });
  },
  setPack: (p) => {
    const next = { ...get().settings, pack: p };
    saveSettings(next);
    set({ settings: next });
  },
  finishSetup: () => {
    const next = { ...get().settings, setupDone: true };
    saveSettings(next);
    set({ settings: next, screen: "main" });
  },
  resetSetup: () => {
    const next = { ...get().settings, setupDone: false };
    saveSettings(next);
    set({ settings: next, screen: "wizard" });
  },
  setPrompt: (text, touched) => set({ prompt: text, promptTouched: touched }),
  resetPrompt: () => set({ prompt: "", promptTouched: false }),
  setDeck: (deck, raw) => set({ deck, rawMarkdown: raw }),
  setGenerating: (b) => set({ generating: b }),
  setError: (e) => set({ error: e }),
}));
