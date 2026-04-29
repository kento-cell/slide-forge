import { useEffect, useState } from "react";
import { useAppStore } from "./store/useAppStore";
import { Wizard } from "./components/Wizard";
import { Header } from "./components/Header";
import { Main } from "./components/Main";
import { Result } from "./components/Result";
import { UpdateBanner } from "./components/UpdateBanner";
import { detectOllama } from "./providers/ollama";

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
  const [detecting, setDetecting] = useState(!settings.setupDone);

  useEffect(() => {
    if (settings.setupDone) {
      // Initial state already false when mounted with setupDone=true,
      // so no setState needed here. Skipping the early-return setState
      // keeps react-hooks/set-state-in-effect happy.
      return;
    }
    // On reset (setupDone went true→false) the loader must come back.
    // This is a legitimate sync setState before the async probe — the
    // alternative (deriving via probeId/completedId pair) is harder to
    // reason about than a single boolean.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetecting(true);
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
        if (!cancelled) setDetecting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.setupDone, setProvider, finishSetup]);

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
        Slide Forge — open source · MIT License ·{" "}
        <a
          href="https://github.com/kento-cell/slide-forge"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-navy-700"
        >
          GitHub
        </a>
      </footer>
    </div>
  );
}
