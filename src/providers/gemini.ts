import type { ProviderConfig } from "../types";

export async function callGemini(
  cfg: ProviderConfig,
  system: string,
  user: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!cfg.apiKey) throw new Error("Gemini API キーが未設定です");
  const model = cfg.model || "gemini-2.5-flash";
  // Send the API key in the x-goog-api-key header rather than the URL
  // query string. URLs are easy to leak via logs, browser history,
  // proxies, and crash reports — headers don't share that exposure
  // surface. Gemini's REST API accepts either form on v1beta.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": cfg.apiKey,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
