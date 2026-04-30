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
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎨</span>
          <div>
            <div className="font-head text-lg font-bold leading-none">
              Slide Forge{" "}
              <span className="ml-1 align-middle font-mono text-[10px] font-normal text-slate-500">
                v{APP_VERSION}
              </span>
            </div>
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
            className="btn-ghost px-2 py-1 text-sm"
            title="プロバイダを変更 (Wizard に戻る)"
            onClick={handleSwitchProvider}
          >
            🔄 プロバイダ変更
          </button>
        </div>
      </div>
    </header>
  );
}
