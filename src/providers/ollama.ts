import type { ProviderConfig } from "../types";

const DEFAULT_ENDPOINT = "http://localhost:11434";

export async function callOllama(
  cfg: ProviderConfig,
  system: string,
  user: string,
  signal?: AbortSignal,
): Promise<string> {
  const endpoint = cfg.endpoint || DEFAULT_ENDPOINT;
  const model = cfg.model || "qwen2.5:14b";
  const res = await fetch(`${endpoint}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      options: { temperature: 0.4 },
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.message?.content ?? "";
}

export async function detectOllama(endpoint = DEFAULT_ENDPOINT): Promise<{
  installed: boolean;
  version?: string;
  models: string[];
}> {
  try {
    const versionRes = await fetch(`${endpoint}/api/version`);
    if (!versionRes.ok) return { installed: false, models: [] };
    const versionData = await versionRes.json();
    const tagsRes = await fetch(`${endpoint}/api/tags`);
    const tagsData = tagsRes.ok ? await tagsRes.json() : { models: [] };
    const models = (tagsData.models ?? []).map((m: { name: string }) => m.name);
    return { installed: true, version: versionData.version, models };
  } catch {
    return { installed: false, models: [] };
  }
}

export async function pullOllamaModel(
  model: string,
  endpoint = DEFAULT_ENDPOINT,
  onProgress?: (pct: number, status: string) => void,
): Promise<void> {
  const res = await fetch(`${endpoint}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: model, stream: true }),
  });
  if (!res.ok || !res.body) throw new Error(`pull failed: ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.completed && obj.total) {
          onProgress?.((obj.completed / obj.total) * 100, obj.status);
        } else if (obj.status) {
          onProgress?.(0, obj.status);
        }
      } catch {
        /* ignore */
      }
    }
  }
}
