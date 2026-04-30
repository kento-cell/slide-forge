import { useEffect, useState } from "react";
import { checkForUpdate, type UpdateInfo } from "../lib/updater";

type Phase = "idle" | "available" | "installing" | "error";

/** Top-of-window banner that appears when a new release is published.
 *
 * Renders only when running inside Tauri AND the configured update
 * endpoint advertises a newer signed release. In browser dev or when
 * the latest release matches the installed version it stays silent.
 */
export function UpdateBanner() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<{ pct: number; bytes: string }>({
    pct: 0,
    bytes: "",
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [installFn, setInstallFn] = useState<
    | ((cb?: (d: number, t?: number) => void) => Promise<void>)
    | null
  >(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const handle = await checkForUpdate();
        if (cancelled || !handle) return;
        if (handle.info.available) {
          setInfo(handle.info);
          setInstallFn(() => handle.install);
          setPhase("available");
        }
      } catch (err) {
        console.warn("[updater] init failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (dismissed || phase === "idle" || !info?.available) return null;

  async function handleInstall() {
    if (!installFn) return;
    setPhase("installing");
    setErrorMsg(null);
    try {
      await installFn((downloaded, total) => {
        const pct = total
          ? Math.min(100, Math.round((downloaded / total) * 100))
          : 0;
        const fmt = (n: number) =>
          n > 1024 * 1024
            ? `${(n / (1024 * 1024)).toFixed(1)}MB`
            : `${(n / 1024).toFixed(0)}KB`;
        const bytes = total
          ? `${fmt(downloaded)} / ${fmt(total)}`
          : fmt(downloaded);
        setProgress({ pct, bytes });
      });
      // relaunch() is called inside install() — control rarely returns.
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  return (
    <div className="border-b border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-2 text-sm">
        <span className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
          更新
        </span>
        {phase === "available" && (
          <>
            <span>
              新しいバージョン <strong>v{info.version}</strong> が利用可能です。
            </span>
            <button
              type="button"
              onClick={handleInstall}
              className="ml-auto rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              今すぐ更新して再起動
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-md px-2 py-1 text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900"
              aria-label="閉じる"
            >
              ×
            </button>
          </>
        )}
        {phase === "installing" && (
          <>
            <span>
              ダウンロード中… {progress.pct}% ({progress.bytes})
            </span>
            <div className="ml-auto h-2 w-40 overflow-hidden rounded bg-emerald-200">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </>
        )}
        {phase === "error" && (
          <>
            <span className="text-red-600">
              更新に失敗しました: {errorMsg}
            </span>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="ml-auto rounded-md px-2 py-1 text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900"
            >
              ×
            </button>
          </>
        )}
      </div>
    </div>
  );
}
