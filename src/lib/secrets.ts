/**
 * API-key storage that prefers the OS-native credential store when
 * running inside Tauri, and degrades to sessionStorage in a browser
 * dev session.
 *
 * Why not localStorage as the dev fallback? localStorage survives a
 * tab close and leaks across HMR reloads — so a dev who pasted a key
 * once would have it sitting on disk. sessionStorage clears with the
 * tab, which is the right tradeoff for "the dev mode is not the
 * shipping product, but I still want the wizard to work".
 *
 * Production (Tauri) uses keyring crate via the secrets::* commands
 * registered in src-tauri/src/lib.rs:
 *   - macOS    -> Keychain Services
 *   - Windows  -> Credential Manager (DPAPI-encrypted)
 *   - Linux    -> Secret Service (gnome-keyring / KWallet)
 */

const SESSION_KEY_PREFIX = "slide-forge.apikey.";

const isTauri = (): boolean =>
  typeof window !== "undefined" &&
  typeof (window as unknown as { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__ !== "undefined";

async function tauriInvoke<T>(
  cmd: "set_api_key" | "get_api_key" | "delete_api_key",
  args: Record<string, unknown>,
): Promise<T> {
  // Lazy import so the browser bundle never tries to resolve
  // @tauri-apps/api at startup.
  const { invoke } = await import("@tauri-apps/api/core");
  return (await invoke(cmd, args)) as T;
}

export async function saveApiKey(
  providerId: string,
  key: string,
): Promise<void> {
  if (!key) {
    await deleteApiKey(providerId);
    return;
  }
  if (isTauri()) {
    await tauriInvoke<void>("set_api_key", { providerId, key });
    return;
  }
  sessionStorage.setItem(SESSION_KEY_PREFIX + providerId, key);
}

export async function getApiKey(providerId: string): Promise<string | null> {
  if (isTauri()) {
    try {
      const v = await tauriInvoke<string | null>("get_api_key", {
        providerId,
      });
      return v ?? null;
    } catch (err) {
      console.warn("[secrets] get_api_key failed:", err);
      return null;
    }
  }
  return sessionStorage.getItem(SESSION_KEY_PREFIX + providerId);
}

export async function deleteApiKey(providerId: string): Promise<void> {
  if (isTauri()) {
    try {
      await tauriInvoke<void>("delete_api_key", { providerId });
    } catch (err) {
      console.warn("[secrets] delete_api_key failed:", err);
    }
    return;
  }
  sessionStorage.removeItem(SESSION_KEY_PREFIX + providerId);
}

/** Move an API key from the legacy localStorage settings blob into the
 *  OS keychain. Idempotent — safe to call on every launch. Returns the
 *  list of providers whose keys were migrated so callers can log it.
 */
export async function migrateLegacyApiKeys(legacy: {
  provider?: { id?: string; apiKey?: string };
}): Promise<string[]> {
  const moved: string[] = [];
  const id = legacy?.provider?.id;
  const apiKey = legacy?.provider?.apiKey;
  if (id && apiKey) {
    await saveApiKey(id, apiKey);
    moved.push(id);
  }
  return moved;
}
