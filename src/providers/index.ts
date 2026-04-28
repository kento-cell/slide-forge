import type { ProviderConfig, ProviderId } from "../types";
import { callGemini } from "./gemini";
import { callGroq } from "./groq";
import { callAnthropic } from "./anthropic";
import { callOpenAI } from "./openai";
import { callOllama } from "./ollama";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  description: string;
  category: "cloud" | "local" | "offline";
  free: boolean;
  defaultModel?: string;
  apiKeyUrl?: string;
  models?: { id: string; label: string }[];
  needsKey: boolean;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    description: "無料枠が大きく個人利用なら実質 ¥0。日本語にも強い。",
    category: "cloud",
    free: true,
    defaultModel: "gemini-1.5-flash",
    apiKeyUrl: "https://aistudio.google.com/apikey",
    models: [
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash (無料枠 / 高速)" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro (高品質)" },
    ],
    needsKey: true,
  },
  {
    id: "groq",
    label: "Groq",
    description: "Llama 3.1 70B が無料・爆速。レート制限はあり。",
    category: "cloud",
    free: true,
    defaultModel: "llama-3.1-70b-versatile",
    apiKeyUrl: "https://console.groq.com/keys",
    models: [
      { id: "llama-3.1-70b-versatile", label: "Llama 3.1 70B (高品質 / 高速)" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B (超高速)" },
    ],
    needsKey: true,
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    description: "従量課金。高品質。長文・推論に強い。",
    category: "cloud",
    free: false,
    defaultModel: "claude-3-5-sonnet-latest",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    models: [
      { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
      { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku (低コスト)" },
    ],
    needsKey: true,
  },
  {
    id: "openai",
    label: "OpenAI GPT",
    description: "従量課金。定番、安定。",
    category: "cloud",
    free: false,
    defaultModel: "gpt-4o-mini",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini (低コスト)" },
      { id: "gpt-4o", label: "GPT-4o (高品質)" },
    ],
    needsKey: true,
  },
  {
    id: "ollama",
    label: "Ollama (ローカル)",
    description: "PC 内で完結。完全無料・オフライン。要 Ollama インストール。",
    category: "local",
    free: true,
    defaultModel: "qwen2.5:14b",
    models: [
      { id: "qwen2.5:14b", label: "Qwen 2.5 14B (推奨 / 日本語強)" },
      { id: "llama3.1:8b", label: "Llama 3.1 8B (軽量)" },
      { id: "llama3.1:70b", label: "Llama 3.1 70B (高性能GPU向)" },
    ],
    needsKey: false,
  },
  {
    id: "offline",
    label: "オフライン (AI なし)",
    description: "Markdown を機械的にスライドへ変換。AI を使わない。",
    category: "offline",
    free: true,
    needsKey: false,
  },
];

export function getProvider(id: ProviderId): ProviderInfo {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

export async function callLLM(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const fn = {
    gemini: callGemini,
    groq: callGroq,
    anthropic: callAnthropic,
    openai: callOpenAI,
    ollama: callOllama,
    offline: async () => {
      throw new Error("offline モードでは LLM は呼び出されません");
    },
  }[config.id];
  return fn(config, systemPrompt, userPrompt, signal);
}

export async function pingProvider(config: ProviderConfig): Promise<boolean> {
  if (config.id === "offline") return true;
  try {
    const out = await callLLM(
      config,
      "Reply only with the single character: OK",
      "Say OK",
    );
    return /ok/i.test(out);
  } catch {
    return false;
  }
}
