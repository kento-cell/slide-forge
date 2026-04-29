/**
 * AI image generation against the user's configured cloud provider.
 *
 * Provider support:
 *   - gemini   : ✅ via gemini-2.5-flash-image-preview (free tier OK)
 *   - openai   : ✅ via gpt-image-1 (paid, ~$0.04/image)
 *   - groq     : ❌ text-only, throws ProviderUnsupportedError
 *   - anthropic: ❌ no image generation API
 *   - ollama   : ❌ skipped (most local installs lack diffusion models)
 *   - offline  : ❌ no network
 *
 * Successful calls return a PNG data URL ready to be wrapped in an
 * ImageSlide and appended to the deck. The caller is responsible for
 * any size normalization (image gen output is already <=1024px so we
 * skip the resize-canvas pass that lib/images.ts does for D&D files).
 */

import type { ImageSlide, ProviderConfig } from "../types";
import { getApiKey } from "../lib/secrets";

export class ProviderUnsupportedError extends Error {
  constructor(providerId: string) {
    super(
      `${providerId} は画像生成に対応していません。Gemini か OpenAI に切り替えてください。`,
    );
    this.name = "ProviderUnsupportedError";
  }
}

const IMAGE_PROVIDERS: ReadonlySet<string> = new Set(["gemini", "openai"]);

export function isImageGenSupported(providerId: string): boolean {
  return IMAGE_PROVIDERS.has(providerId);
}

export interface GeneratedImage {
  /** PNG data URL: "data:image/png;base64,..." */
  dataUrl: string;
  width: number;
  height: number;
  prompt: string;
}

/** Generate one image. Throws ProviderUnsupportedError if the provider
 *  doesn't support image generation. */
export async function generateImage(
  config: ProviderConfig,
  prompt: string,
  signal?: AbortSignal,
): Promise<GeneratedImage> {
  if (!IMAGE_PROVIDERS.has(config.id)) {
    throw new ProviderUnsupportedError(config.id);
  }

  // Hydrate API key from keyring if the in-memory config doesn't have
  // one (the steady state after app restart).
  let cfg = config;
  if (!cfg.apiKey) {
    const stored = await getApiKey(config.id);
    if (stored) cfg = { ...config, apiKey: stored };
  }
  if (!cfg.apiKey) {
    throw new Error("API キーが設定されていません。Wizard で再設定してください。");
  }

  if (cfg.id === "gemini") {
    return generateImageGemini(cfg, prompt, signal);
  }
  if (cfg.id === "openai") {
    return generateImageOpenAI(cfg, prompt, signal);
  }
  throw new ProviderUnsupportedError(cfg.id);
}

/** Wrap a generated image in an ImageSlide ready to push into the
 *  deck. Title is derived from the prompt's first ~40 chars. */
export function generatedImageToSlide(image: GeneratedImage): ImageSlide {
  const title = titleFromPrompt(image.prompt);
  return {
    kind: "image",
    title,
    dataUrl: image.dataUrl,
    alt: title,
    caption: image.prompt.length > 80
      ? image.prompt.slice(0, 77) + "…"
      : image.prompt,
    width: image.width,
    height: image.height,
  };
}

// ---------------------------------------------------------------------
// Gemini implementation
// ---------------------------------------------------------------------

// Gemini's image-generation model names have churned between Aug 2025
// and now (Apr 2026). The exact model varies by region and API tier,
// so we probe candidates in order and use whichever the user's key has
// access to. The :generateContent flow with responseModalities ["IMAGE"]
// works for the gemini-* models; Imagen models use :predict which is a
// different shape and not covered here (yet).
const GEMINI_IMAGE_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.0-flash-exp-image-generation",
];

async function generateImageGemini(
  cfg: ProviderConfig,
  prompt: string,
  signal?: AbortSignal,
): Promise<GeneratedImage> {
  const errors: string[] = [];
  for (const model of GEMINI_IMAGE_MODELS) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    };
    // Aborts and network errors propagate; don't silently iterate.
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": cfg.apiKey!,
      },
      body: JSON.stringify(body),
      signal,
    });
    if (res.status === 404 || res.status === 400) {
      // Model unavailable for this key/region — fall through to next.
      const text = await res.text().catch(() => "");
      errors.push(`${model} ${res.status}: ${text.slice(0, 100)}`);
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini image gen ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(
      (p: unknown): p is { inlineData: { mimeType: string; data: string } } =>
        typeof p === "object" &&
        p !== null &&
        "inlineData" in p &&
        typeof (p as { inlineData?: unknown }).inlineData === "object",
    );
    if (!imagePart) {
      // Some models return TEXT instead when content was filtered.
      const textPart = parts.find(
        (p: unknown): p is { text: string } =>
          typeof p === "object" && p !== null && typeof (p as { text?: unknown }).text === "string",
      );
      const reason = textPart?.text || "原因不明";
      throw new Error(`Gemini が画像を返しませんでした: ${reason.slice(0, 200)}`);
    }
    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const dataUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`;
    const dims = await measureDataUrl(dataUrl);
    return { dataUrl, width: dims.width, height: dims.height, prompt };
  }
  // Final fallback: Imagen 3 via :predict endpoint. Imagen requires a
  // billed Google Cloud account so this only works for paid keys, but
  // it's worth trying after the free-tier gemini-* models 404.
  try {
    return await generateImageImagen(cfg, prompt, signal);
  } catch (err) {
    errors.push(
      `imagen-3.0-generate-002: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  throw new Error(
    `Gemini で利用可能な画像生成モデルが見つかりませんでした。` +
      `画像生成は地域・API ティアによって対応モデルが異なります。\n` +
      `候補モデル: ${GEMINI_IMAGE_MODELS.join(", ")}\n` +
      `エラー詳細: ${errors.join(" | ")}`,
  );
}

async function generateImageImagen(
  cfg: ProviderConfig,
  prompt: string,
  signal?: AbortSignal,
): Promise<GeneratedImage> {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    "imagen-3.0-generate-002:predict";
  const body = {
    instances: [{ prompt }],
    parameters: { sampleCount: 1 },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": cfg.apiKey!,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Imagen ${res.status}: ${text.slice(0, 150)}`);
  }
  const data = await res.json();
  const pred = data?.predictions?.[0];
  const b64 = pred?.bytesBase64Encoded as string | undefined;
  if (!b64) {
    throw new Error("Imagen が画像を返しませんでした");
  }
  const mimeType = (pred?.mimeType as string | undefined) || "image/png";
  const dataUrl = `data:${mimeType};base64,${b64}`;
  const dims = await measureDataUrl(dataUrl);
  return { dataUrl, width: dims.width, height: dims.height, prompt };
}

// ---------------------------------------------------------------------
// OpenAI implementation
// ---------------------------------------------------------------------

async function generateImageOpenAI(
  cfg: ProviderConfig,
  prompt: string,
  signal?: AbortSignal,
): Promise<GeneratedImage> {
  const url = "https://api.openai.com/v1/images/generations";
  const body = {
    model: "gpt-image-1",
    prompt,
    size: "1024x1024",
    n: 1,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey!}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI image gen ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json as string | undefined;
  if (!b64) {
    throw new Error("OpenAI が画像を返しませんでした。プロンプトを変えてみてください。");
  }
  const dataUrl = `data:image/png;base64,${b64}`;
  const dims = await measureDataUrl(dataUrl);
  return { dataUrl, width: dims.width, height: dims.height, prompt };
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

async function measureDataUrl(
  dataUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("生成画像をデコードできませんでした"));
    img.src = dataUrl;
  });
}

function titleFromPrompt(prompt: string): string {
  const cleaned = prompt
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "AI 生成画像";
  return cleaned.slice(0, 40);
}
