import type { ProviderConfig } from "../types";

export async function callOpenAI(
  cfg: ProviderConfig,
  system: string,
  user: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!cfg.apiKey) throw new Error("OpenAI API キーが未設定です");
  const model = cfg.model || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      max_tokens: 4096,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}
