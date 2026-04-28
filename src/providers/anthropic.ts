import type { ProviderConfig } from "../types";

export async function callAnthropic(
  cfg: ProviderConfig,
  system: string,
  user: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!cfg.apiKey) throw new Error("Anthropic API キーが未設定です");
  const model = cfg.model || "claude-3-5-sonnet-latest";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.content?.[0]?.text ?? "";
}
