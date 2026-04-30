import { useEffect } from "react";
import { useAppStore } from "./store/useAppStore";
import { Wizard } from "./components/Wizard";
import { Header } from "./components/Header";
import { Main } from "./components/Main";
import { Result } from "./components/Result";
import { UpdateBanner } from "./components/UpdateBanner";
import { migrateLegacyApiKeys } from "./lib/secrets";
import { openExternalUrl } from "./lib/openUrl";
import { APP_VERSION } from "./lib/version";

export default function App() {
  const screen = useAppStore((s) => s.screen);
  const setProvider = useAppStore((s) => s.setProvider);

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

  // Auto-detect of Ollama on first launch was removed: users reported
  // they wanted to always see the mode-selection wizard so they could
  // pick deliberately (e.g., when their Ollama install is broken or
  // they want Cloud despite having Ollama running). The Wizard's
  // LocalStage still does its own detection when the user picks
  // "ローカル AI", so the convenience isn't lost — just not silent.

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
