/**
 * Open a URL in the system's default browser.
 *
 * In Tauri, `<a target="_blank">` navigates the WebView2 main window
 * (or gets blocked, depending on config) — neither does what users
 * expect from "open external link". Use the opener plugin so the
 * URL launches in the OS's actual browser.
 *
 * In a plain browser dev session (npm run dev) the plugin doesn't
 * exist; fall through to window.open which behaves correctly there.
 */

const isTauri = (): boolean =>
  typeof window !== "undefined" &&
  typeof (window as unknown as { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__ !== "undefined";

export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    } catch (err) {
      console.warn("[opener] openUrl failed, falling back:", err);
      // Fall through to window.open — last-ditch effort. May still
      // be blocked but at least we tried.
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
