import { useEffect, useState } from "react";
import { useAppStore } from "./store/useAppStore";
import { Wizard } from "./components/Wizard";
import { Header } from "./components/Header";
import { Main } from "./components/Main";
import { Result } from "./components/Result";
import { UpdateBanner } from "./components/UpdateBanner";
import { detectOllama } from "./providers/ollama";
import { migrateLegacyApiKeys } from "./lib/secrets";
import { openExternalUrl } from "./lib/openUrl";
import { APP_VERSION } from "./lib/version";

// Models the app generates well with, in preference order.
// First match against the user's installed list wins.
const PREFERRED_MODELS: string[] = [
  "qwen2.5:14b",
  "qwen2.5:7b",
  "qwen3:14b",
  "qwen3:7b",
  "gemma3:12b",
  "gemma3:7b",
  "gemma2:9b",
  "llama3.1:8b",
  "llama3:8b",
  "mistral:7b",
];

function pickBestInstalledModel(installed: string[]): string {
  for (const p of PREFERRED_MODELS) {
    const exact = installed.find((m) => m === p);
    if (exact) return exact;
    const prefix = installed.find((m) => m.startsWith(p));
    if (prefix) return prefix;
  }
  return installed[0];
}

export default function App() {
  const screen = useAppStore((s) => s.screen);
  const settings = useAppStore((s) => s.settings);
  const setProvider = useAppStore((s) => s.setProvider);
  const finishSetup = useAppStore((s) => s.finishSetup);
  // Auto-detect runs once per app session. After it completes (success
  // or fail), `autoDetectAttempted` flips true and never resets — so a
  // user-triggered resetSetup() (⚙ button or "← モード選択に戻る") sends
  // them to the wizard instead of being bounced back to Main by an
  // immediate re-detect of their already-running Ollama.
  //
  // Initial value: if the user has setupDone=true, they already chose
  // a provider in a prior session — auto-detect is OBSOLETE for them
  // and must stay disabled even if they later reset. Without this
  // initializer, hitting ⚙ on a returning user's app would re-trigger
  // the probe and bounce them straight back to Main.
  const [autoDetectAttempted, setAutoDetectAttempted] = useState(
    settings.setupDone,
  );
  const [detecting, setDetecting] = useState(!settings.setupDone);

  // One-shot migration on app start: lift any plain-text apiKey that
  // previous versions wrote to localStorage into the OS keychain, then
  // strip it from localStorage. Idempotent — subsequent launches see
  // the key gone from localStorage and skip silently. Async, but
  // doesn't gate the UI: the call to setProvider in the auto-detect
  // effect overwrites with a sanitized provider config anyway.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = localStorage.getItem("slide-forge.settings.v1");
        if (!raw) return;
        const parsed = JSON.parse(raw) as {
          provider?: { id?: string; apiKey?: string };
        };
        if (!parsed?.provider?.apiKey) return;
        const moved = await migrateLegacyApiKeys(parsed);
        if (cancelled) return;
        if (moved.length > 0) {
          // Re-save without apiKey by going through the store, which
          // routes to the sanitized saveSettings path.
          setProvider({
            id: parsed.provider.id as never,
            ...(parsed.provider as { model?: string; endpoint?: string }),
            apiKey: undefined,
          });
        }
      } catch (err) {
        console.warn("[migration] legacy api key migration failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setProvider]);

  useEffect(() => {
    // Already set up — nothing to do.
    if (settings.setupDone) return;
    // After the first attempt this effect must NOT re-run the probe.
    // Otherwise hitting ⚙ → resetSetup would immediately re-detect
    // Ollama and bounce the user back to Main, defeating the wizard.
    if (autoDetectAttempted) return;

    let cancelled = false;
    (async () => {
      try {
        const r = await detectOllama();
        if (cancelled) return;
        if (r.installed && r.models.length > 0) {
          const model = pickBestInstalledModel(r.models);
          setProvider({ id: "ollama", model });
          finishSetup();
        }
      } catch {
        // fall through to wizard
      } finally {
        if (!cancelled) {
          // Both setState calls happen inside an async callback (after
          // await) — react-hooks/set-state-in-effect tolerates that.
          setDetecting(false);
          setAutoDetectAttempted(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.setupDone, autoDetectAttempted, setProvider, finishSetup]);

  if (detecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-200 border-t-navy-700" />
          <div className="text-sm text-slate-500">ローカル AI を検出中…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <UpdateBanner />
      {screen !== "wizard" && <Header />}
      <main className="flex-1">
        {screen === "wizard" && <Wizard />}
        {screen === "main" && <Main />}
        {screen === "result" && <Result />}
      </main>
      <footer className="border-t border-slate-200 px-6 py-3 text-center text-xs text-slate-500 dark:border-slate-800">
        Slide Forge <span className="font-mono">v{APP_VERSION}</span> — open source · MIT License ·{" "}
        <button
          type="button"
          onClick={() => openExternalUrl("https://github.com/kento-cell/slide-forge")}
          className="underline hover:text-navy-700"
        >
          GitHub
        </button>
      </footer>
    </div>
  );
}
