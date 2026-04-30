import { useAppStore } from "../store/useAppStore";
import { getProvider } from "../providers";
import { deleteApiKey } from "../lib/secrets";
import { APP_VERSION } from "../lib/version";

export function Header() {
  const settings = useAppStore((s) => s.settings);
  const setProvider = useAppStore((s) => s.setProvider);
  const resetSetup = useAppStore((s) => s.resetSetup);
  const provider = getProvider(settings.provider.id);

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

  function handleSwitchProvider() {
    // Confirm because the action wipes the user's mid-edit state and
    // boots them back to the Wizard. Without confirmation a misclick
    // on the formerly-mysterious ⚙ icon was destructive.
    const ok = window.confirm(
      "プロバイダを変更すると現在の設定画面 (テーマ・パック等) を保ったまま Wizard に戻ります。続行しますか?",
    );
    if (!ok) return;
    resetSetup();
  }

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-baseline gap-3">
          <div className="font-head text-base font-semibold tracking-tight">
            Slide Forge
          </div>
          <span className="font-mono text-[11px] text-slate-400">
            v{APP_VERSION}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="hidden sm:inline-flex items-center gap-2 border-l border-slate-200 pl-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
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
              className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              title="保存済み API キーを削除"
              onClick={handleClearKey}
            >
              キー削除
            </button>
          )}
          <button
            type="button"
            className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            title="プロバイダを変更 (Wizard に戻る)"
            onClick={handleSwitchProvider}
          >
            プロバイダ変更
          </button>
        </div>
      </div>
    </header>
  );
}
