import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { getProvider } from "../providers";
import { deleteApiKey } from "../lib/secrets";

export function Header() {
  const settings = useAppStore((s) => s.settings);
  const setProvider = useAppStore((s) => s.setProvider);
  const resetSetup = useAppStore((s) => s.resetSetup);
  const provider = getProvider(settings.provider.id);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const isCloud = provider.category === "cloud";

  async function handleClearKey() {
    if (!isCloud) return;
    const ok = window.confirm(
      `${provider.label} の保存済み API キーを削除しますか?\n` +
        "削除後、Cloud AI を使うには再セットアップが必要です。",
    );
    if (!ok) return;
    await deleteApiKey(settings.provider.id);
    // Drop the in-memory key too, then bounce to wizard for clarity.
    setProvider({ id: settings.provider.id, model: settings.provider.model });
    resetSetup();
  }

  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎨</span>
          <div>
            <div className="font-head text-lg font-bold leading-none">Slide Forge</div>
            <div className="text-[10px] text-slate-500">プロンプトから PowerPoint を生成</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">
            <span
              className={`h-2 w-2 rounded-full ${
                provider.id === "offline"
                  ? "bg-amber-500"
                  : provider.category === "local"
                  ? "bg-emerald-500"
                  : "bg-navy-500"
              }`}
            />
            {provider.label}
          </span>
          {isCloud && (
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-base"
              title="保存済み API キーを削除"
              onClick={handleClearKey}
            >
              🗑
            </button>
          )}
          <button
            type="button"
            className="btn-ghost px-2 py-1 text-base"
            title="ダーク/ライト切替"
            onClick={() => setDark((d) => !d)}
          >
            {dark ? "☀" : "🌙"}
          </button>
          <button
            type="button"
            className="btn-ghost px-2 py-1 text-base"
            title="モード選択に戻る"
            onClick={resetSetup}
          >
            ⚙
          </button>
        </div>
      </div>
    </header>
  );
}
