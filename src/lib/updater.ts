/**
 * Self-update orchestration. Wraps the Tauri updater plugin so the rest
 * of the React app can stay agnostic of whether it's running inside
 * Tauri (desktop) or a plain browser dev session.
 *
 * In browser dev (npm run dev with `vite preview`) the updater plugin
 * is unavailable; every call resolves to "no update". In Tauri the
 * plugin contacts the configured endpoint and reports the latest
 * release shipped with a matching signature.
 */

export interface UpdateInfo {
  available: boolean;
  version?: string;
  body?: string;
  // Whether this build is running inside the Tauri shell. When false,
  // the updater can never fire — useful for hiding the UI in
  // dev/browser sessions.
  isTauri: boolean;
}

export interface UpdateHandle {
  info: UpdateInfo;
  install: (
    onProgress?: (downloaded: number, total: number | undefined) => void,
  ) => Promise<void>;
}

const isTauri = (): boolean =>
  typeof window !== "undefined" &&
  // Tauri 2 sets __TAURI_INTERNALS__ on the global. Anchor on this
  // rather than user agent — UA can be spoofed and tauri:dev sessions
  // sometimes report the underlying webview UA.
  typeof (window as unknown as { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__ !== "undefined";

export async function checkForUpdate(): Promise<UpdateHandle | null> {
  if (!isTauri()) {
    return {
      info: { available: false, isTauri: false },
      install: async () => {
        /* no-op in browser */
      },
    };
  }
  // Defer the import so vite doesn't try to resolve the Tauri plugin
  // at build time when running outside Tauri (it'd fail with "module
  // not found" in browser dev).
  const updater = await import("@tauri-apps/plugin-updater");
  const proc = await import("@tauri-apps/plugin-process");

  let update: Awaited<ReturnType<typeof updater.check>> | null = null;
  try {
    update = await updater.check();
  } catch (err) {
    console.warn("[updater] check failed:", err);
    return {
      info: { available: false, isTauri: true },
      install: async () => {},
    };
  }

  if (!update) {
    return {
      info: { available: false, isTauri: true },
      install: async () => {},
    };
  }

  const info: UpdateInfo = {
    available: true,
    version: update.version,
    body: update.body,
    isTauri: true,
  };
  return {
    info,
    install: async (onProgress) => {
      let downloaded = 0;
      let total: number | undefined;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? undefined;
          onProgress?.(0, total);
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          onProgress?.(downloaded, total);
        } else if (event.event === "Finished") {
          onProgress?.(downloaded, total);
        }
      });
      // Successful install on Windows/Linux requires a relaunch to
      // load the new binary. macOS handles this in-process, but
      // calling relaunch is harmless there.
      await proc.relaunch();
    },
  };
}
