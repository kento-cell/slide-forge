/**
 * Ollama provider — every HTTP call is routed through Rust via Tauri
 * `invoke`, NOT `fetch`. Rationale: the Tauri 2 webview origin
 * (`http://tauri.localhost` on Windows, `tauri://localhost` elsewhere)
 * is rejected by Ollama's default `OLLAMA_ORIGINS` allowlist, so a
 * direct `fetch("http://localhost:11434/...")` from the webview is
 * blocked at the CORS preflight step. The Rust bridge has no browser
 * involved, so it talks to the daemon cleanly.
 *
 * If `invoke` is unavailable (e.g. running the SPA bundle in a plain
 * browser for component dev), every function falls back to a noop
 * "not installed" result so the UI degrades gracefully instead of
 * exploding.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ProviderConfig } from "../types";

const DEFAULT_ENDPOINT = "http://localhost:11434";

interface DetectResult {
  installed: boolean;
  version?: string;
  models: string[];
}

function inTauri(): boolean {
  // Tauri 2 sets this on the global. The check has to be a
  // typeof-window guard so SSR / unit-test envs don't trip on it.
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function callOllama(
  cfg: ProviderConfig,
  system: string,
  user: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!inTauri()) {
    throw new Error("Ollama は Tauri 環境でのみ利用できます。");
  }
  const endpoint = cfg.endpoint || DEFAULT_ENDPOINT;
  const model = cfg.model || "qwen2.5:14b";

  // The Rust command isn't cancellable mid-flight today (the LLM
  // round-trip is one long await), so we honour a pre-cancelled
  // signal but otherwise let it run to completion. Wiring true
  // cancellation requires a follow-up command that holds an abort
  // handle keyed by request id.
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");

  return invoke<string>("ollama_chat", {
    endpoint,
    model,
    system,
    user,
    temperature: 0.4,
  });
}

export async function detectOllama(
  endpoint = DEFAULT_ENDPOINT,
): Promise<DetectResult> {
  if (!inTauri()) return { installed: false, models: [] };
  try {
    return await invoke<DetectResult>("ollama_detect", { endpoint });
  } catch {
    return { installed: false, models: [] };
  }
}

export async function pullOllamaModel(
  model: string,
  endpoint: string = DEFAULT_ENDPOINT,
  onProgress?: (pct: number, status: string) => void,
): Promise<void> {
  if (!inTauri()) {
    throw new Error("Ollama は Tauri 環境でのみ利用できます。");
  }
  // Subscribe BEFORE invoking so we don't miss the early "downloading"
  // events. The Rust side fires the first event once the response
  // body starts streaming.
  const unlisten = await listen<{
    status: string;
    completed?: number;
    total?: number;
  }>("ollama-pull-progress", (e) => {
    const { status, completed, total } = e.payload;
    const pct = completed && total ? (completed / total) * 100 : 0;
    onProgress?.(pct, status);
  });
  try {
    await invoke("ollama_pull", { endpoint, model });
  } finally {
    unlisten();
  }
}
