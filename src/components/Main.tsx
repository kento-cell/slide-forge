import { useCallback, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { DEFAULT_PROMPT, OFFLINE_SAMPLE_MARKDOWN } from "../samples/defaultPrompt";
import { THEMES } from "../pptx/themes";
import { callLLM } from "../providers";
import { SYSTEM_PROMPT, buildUserPrompt } from "../lib/llmPrompt";
import { parseMarkdown } from "../md/parser";
import { useElapsedSec, formatElapsed } from "../lib/useElapsedSec";
import {
  ACCEPTED_TEXT_AND_IMAGE_FILES,
  filesToImageSlides,
  imageSlidesToMarkdown,
  isSupportedImageFile,
  isTextFile,
} from "../lib/images";
import { BackButton } from "./BackButton";
import {
  generateImage,
  generatedImageToSlide,
  isImageGenSupported,
} from "../providers/imageGen";
import { autoIllustrateDeck } from "../providers/autoIllustrate";
import type { ImageSlide, ThemeId } from "../types";

export function Main() {
  const settings = useAppStore((s) => s.settings);
  const setTheme = useAppStore((s) => s.setTheme);
  const resetSetup = useAppStore((s) => s.resetSetup);
  const prompt = useAppStore((s) => s.prompt);
  const promptTouched = useAppStore((s) => s.promptTouched);
  const setPrompt = useAppStore((s) => s.setPrompt);
  const setDeck = useAppStore((s) => s.setDeck);
  const generating = useAppStore((s) => s.generating);
  const setGenerating = useAppStore((s) => s.setGenerating);
  const setScreen = useAppStore((s) => s.setScreen);
  const error = useAppStore((s) => s.error);
  const setError = useAppStore((s) => s.setError);

  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const elapsedSec = useElapsedSec(generating);

  // AI image generation panel — uses the user's configured cloud
  // provider (Gemini or OpenAI). Generated images stay in component
  // state as a "pending" list and are appended to the deck on the
  // main [▶ 生成] click.
  const [imageGenPrompt, setImageGenPrompt] = useState("");
  const [pendingImages, setPendingImages] = useState<ImageSlide[]>([]);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imageGenError, setImageGenError] = useState<string | null>(null);
  const imageGenAbortRef = useRef<AbortController | null>(null);
  const imageElapsedSec = useElapsedSec(generatingImage);
  const imageGenSupported = isImageGenSupported(settings.provider.id);

  // Per-slide auto-illustration: when on, after the deck is parsed
  // we walk through cover/bullets/section/summary slides and embed
  // a generated image into each.
  const [autoIllustrate, setAutoIllustrate] = useState(false);
  const [illustrationProgress, setIllustrationProgress] = useState<
    { done: number; total: number; title: string } | null
  >(null);

  const isOffline = settings.provider.id === "offline";
  // Offline mode parses the textarea as Markdown directly, so the
  // sample shown when the user hasn't typed anything must be real
  // Markdown (with # / ## headers), not the AI task prompt that has
  // headers documented inside a code-fence-like description.
  const sampleForCurrentMode = isOffline ? OFFLINE_SAMPLE_MARKDOWN : DEFAULT_PROMPT;
  const displayValue = promptTouched ? prompt : sampleForCurrentMode;

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const incoming = Array.from(files);
      const textFiles = incoming.filter(isTextFile);
      const imageFiles = incoming.filter(isSupportedImageFile);
      const unsupported = incoming.filter(
        (file) => !isTextFile(file) && !isSupportedImageFile(file),
      );

      if (unsupported.length > 0) {
        setError(
          "対応ファイルは .md / .markdown / .txt / .png / .jpg / .jpeg / .webp / .gif です",
        );
        return;
      }
      if (textFiles.length > 1) {
        setError("テキストファイルは一度に1つまで投入できます");
        return;
      }
      if (textFiles.length === 0 && imageFiles.length === 0) {
        setError("テキストまたは画像ファイルを投入してください");
        return;
      }

      try {
        const text = textFiles[0] ? await textFiles[0].text() : "";
        if (imageFiles.length === 0) {
          setPrompt(text, true);
          setError(null);
          return;
        }

        const imageSlides = await filesToImageSlides(imageFiles);
        const parsed = text.trim() ? parseMarkdown(text) : null;
        const hasParsedSlides = Boolean(parsed && parsed.slides.length > 0);
        const title =
          hasParsedSlides && parsed
            ? parsed.title
            : imageSlides.length === 1
              ? imageSlides[0].title
              : "画像スライド";
        const deck = {
          title,
          slides: [
            ...(hasParsedSlides && parsed ? parsed.slides : []),
            ...imageSlides,
          ],
        };
        const raw = [
          hasParsedSlides ? text.trim() : `# ${title}`,
          imageSlidesToMarkdown(imageSlides),
        ].join("\n\n");
        setPrompt(text, Boolean(text));
        setDeck(deck, raw);
        setScreen("result");
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "ファイルの読み込みに失敗しました");
      }
    },
    [setDeck, setError, setPrompt, setScreen],
  );

  // Cap any single LLM call. Cloud providers usually answer in <30s;
  // local Ollama models may take 1-3min on a heavy machine. Five
  // minutes is forgiving without leaving the user trapped on a hung
  // request.
  const GENERATION_TIMEOUT_MS = 5 * 60 * 1000;

  function handleCancel() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }

  // Cap a single image generation. Image APIs typically respond in
  // 10-30s (Gemini) or 20-60s (OpenAI gpt-image-1). 3 minutes is the
  // failure ceiling.
  const IMAGE_GEN_TIMEOUT_MS = 3 * 60 * 1000;

  async function handleGenerateImage() {
    setImageGenError(null);
    const trimmed = imageGenPrompt.trim();
    if (!trimmed) {
      setImageGenError("画像のプロンプトを入力してください");
      return;
    }
    if (!imageGenSupported) {
      setImageGenError(
        "現在のプロバイダは画像生成に未対応です。Gemini か OpenAI に切替えてください。",
      );
      return;
    }

    if (imageGenAbortRef.current) imageGenAbortRef.current.abort();
    const controller = new AbortController();
    imageGenAbortRef.current = controller;
    const timeoutId = window.setTimeout(() => {
      controller.abort(new DOMException("timeout", "TimeoutError"));
    }, IMAGE_GEN_TIMEOUT_MS);

    setGeneratingImage(true);
    try {
      const generated = await generateImage(
        settings.provider,
        trimmed,
        controller.signal,
      );
      const slide = generatedImageToSlide(generated);
      setPendingImages((cur) => [...cur, slide]);
      setImageGenPrompt("");
    } catch (e) {
      if (controller.signal.aborted) {
        const reason = controller.signal.reason;
        if (reason instanceof DOMException && reason.name === "TimeoutError") {
          setImageGenError(
            `画像生成が ${IMAGE_GEN_TIMEOUT_MS / 60000} 分以内に完了しませんでした`,
          );
        } else {
          setImageGenError("キャンセルしました");
        }
      } else {
        setImageGenError(e instanceof Error ? e.message : "画像生成に失敗しました");
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (imageGenAbortRef.current === controller) imageGenAbortRef.current = null;
      setGeneratingImage(false);
    }
  }

  function handleCancelImageGen() {
    if (imageGenAbortRef.current) {
      imageGenAbortRef.current.abort();
      imageGenAbortRef.current = null;
    }
  }

  function handleRemovePendingImage(index: number) {
    setPendingImages((cur) => cur.filter((_, i) => i !== index));
  }

  async function handleGenerate() {
    setError(null);
    const userInput = (promptTouched ? prompt : sampleForCurrentMode).trim();
    if (!userInput) {
      setError("プロンプトを入力してください");
      return;
    }

    // Wire an AbortController so the user can cancel mid-flight and
    // we still bound the worst case with a timeout. The hard timeout
    // and the user's cancel both flow through the same signal so the
    // provider stops fetching ASAP.
    handleCancel();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = window.setTimeout(() => {
      controller.abort(new DOMException("timeout", "TimeoutError"));
    }, GENERATION_TIMEOUT_MS);

    setGenerating(true);
    try {
      let markdown: string;
      if (isOffline) {
        markdown = userInput;
      } else {
        markdown = await callLLM(
          settings.provider,
          SYSTEM_PROMPT,
          buildUserPrompt(userInput),
          controller.signal,
        );
      }
      const cleaned = stripCodeFence(markdown);
      let parsed = parseMarkdown(cleaned);
      if (parsed.slides.length === 0 && pendingImages.length === 0) {
        throw new Error(
          "スライドを抽出できませんでした。# / ## の見出しを使ってください。",
        );
      }
      // Auto-illustrate each cover/bullets/section/summary slide
      // with an image derived from that slide's content. Sequential
      // because most providers rate-limit parallel image gen calls.
      if (autoIllustrate && imageGenSupported) {
        const illResult = await autoIllustrateDeck(
          parsed,
          settings.provider,
          {
            signal: controller.signal,
            onProgress: (done, total, title) =>
              setIllustrationProgress({ done, total, title }),
          },
        );
        parsed = illResult.deck;
        if (illResult.failures.length > 0) {
          // Don't fail the whole generation — just surface what
          // skipped so the user can retry / lower expectations.
          setError(
            `画像生成に失敗したスライド: ${illResult.failures.length} 件 ` +
              `(${illResult.failures.map((f) => f.title).slice(0, 3).join(", ")} 等)`,
          );
        }
      }
      // Append AI-generated images (in order they were generated) to
      // the parsed deck. They become regular image slides in the deck
      // and disappear from the "pending" panel on success.
      const finalDeck = {
        ...parsed,
        title:
          parsed.title === "Untitled Deck" && pendingImages.length > 0
            ? pendingImages[0].title
            : parsed.title,
        slides: [...parsed.slides, ...pendingImages],
      };
      const finalRaw = pendingImages.length > 0
        ? `${cleaned}\n\n${imageSlidesToMarkdown(pendingImages)}`
        : cleaned;
      setDeck(finalDeck, finalRaw);
      setPendingImages([]);
      setScreen("result");
    } catch (e) {
      if (controller.signal.aborted) {
        const reason = controller.signal.reason;
        if (reason instanceof DOMException && reason.name === "TimeoutError") {
          setError(
            `生成が ${GENERATION_TIMEOUT_MS / 60000} 分以内に完了しませんでした。` +
              "プロンプトを短くするか、別のモデル/プロバイダで再試行してください。",
          );
        } else {
          setError("キャンセルしました");
        }
      } else {
        setError(e instanceof Error ? e.message : "生成に失敗しました");
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (abortRef.current === controller) abortRef.current = null;
      setGenerating(false);
      setIllustrationProgress(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <BackButton onClick={resetSetup} label="モード選択に戻る" topNav />
        <h1 className="font-head text-2xl font-bold">プロンプトを書いて [生成]</h1>
        <p className="text-sm text-slate-500">
          {isOffline
            ? "AI なしモード: Markdown を直接 PowerPoint に変換します"
            : "下のサンプルをそのまま [生成] でも動きます。編集すれば内容に追従します。"}
        </p>
      </div>

      <div
        className={`relative card transition ${
          dragging ? "ring-4 ring-navy-300" : ""
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800">
          <span>📁 .md / .txt / 画像をドラッグ&ドロップ もしくは下に直接入力</span>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_TEXT_AND_IMAGE_FILES}
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <button
              type="button"
              className="rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => fileRef.current?.click()}
            >
              ファイル選択
            </button>
            {promptTouched && (
              <button
                type="button"
                className="rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setPrompt("", false)}
                title="サンプルに戻す"
              >
                ↻ サンプル
              </button>
            )}
          </div>
        </div>
        <textarea
          value={displayValue}
          onChange={(e) => setPrompt(e.target.value, true)}
          spellCheck={false}
          className={`block h-[420px] w-full resize-y bg-transparent p-4 font-mono text-sm leading-relaxed outline-none ${
            promptTouched
              ? "text-slate-900 dark:text-slate-100"
              : "italic text-slate-400 dark:text-slate-500"
          }`}
        />
        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-navy-700/10 text-lg font-bold text-navy-700">
            ここにドロップ
          </div>
        )}
      </div>

      {/* AI image generation panel — uses the configured cloud provider's
          image API (Gemini / OpenAI). Generated images become image
          slides appended to the deck on the main [▶ 生成]. */}
      <div className="card mt-6 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">🎨 AI で画像を生成 (オプション)</span>
          <span className="text-[10px] text-slate-500">
            {imageGenSupported
              ? `${settings.provider.id === "gemini" ? "Gemini" : "OpenAI gpt-image-1"} を使用`
              : "現在のプロバイダは未対応 (Gemini / OpenAI に切替えて利用)"}
          </span>
        </div>
        {imageGenSupported && (
          <>
            <textarea
              value={imageGenPrompt}
              onChange={(e) => setImageGenPrompt(e.target.value)}
              spellCheck={false}
              placeholder="例: 黄金色の夕暮れの海岸を描く水彩画。柔らかいパステル、キャラクター無し、夢幻的な雰囲気。16:9 横長。"
              className="block h-20 w-full resize-y rounded border border-slate-200 bg-white p-2 font-mono text-xs leading-relaxed outline-none focus:border-navy-400 dark:border-slate-700 dark:bg-slate-900"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                className="btn-outline text-sm"
                onClick={handleGenerateImage}
                disabled={generatingImage || !imageGenPrompt.trim()}
              >
                {generatingImage ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-navy-700" />
                    生成中… {formatElapsed(imageElapsedSec)}
                  </span>
                ) : (
                  "🎨 画像を生成"
                )}
              </button>
              {generatingImage && (
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  onClick={handleCancelImageGen}
                >
                  ⏹ キャンセル
                </button>
              )}
              {pendingImages.length > 0 && (
                <span className="text-xs text-slate-500">
                  生成済み {pendingImages.length} 枚 (生成ボタンで deck 末尾に追加)
                </span>
              )}
            </div>
            {imageGenError && (
              <div className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
                {imageGenError}
              </div>
            )}
            {pendingImages.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {pendingImages.map((img, i) => (
                  <div
                    key={i}
                    className="group relative overflow-hidden rounded border border-slate-200 dark:border-slate-700"
                  >
                    <img
                      src={img.dataUrl}
                      alt={img.alt}
                      className="aspect-video w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePendingImage(i)}
                      className="absolute right-1 top-1 rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-red-600 shadow opacity-0 transition group-hover:opacity-100"
                      title="この画像を削除"
                    >
                      ✕
                    </button>
                    <div className="truncate bg-slate-50 px-2 py-1 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {img.title}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Per-slide auto-illustration checkbox. Hooks into handleGenerate
          to walk cover/bullets/section/summary slides and embed an
          image derived from each slide's content. Requires the cloud
          provider to support image gen (Gemini / OpenAI). */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={autoIllustrate}
            disabled={!imageGenSupported}
            onChange={(e) => setAutoIllustrate(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <div className="font-semibold">
              📸 各スライドに自動でイラストを添付
              {!imageGenSupported && (
                <span className="ml-2 text-xs text-amber-600">
                  (Gemini / OpenAI に切替えると有効)
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500">
              cover / bullets / section / まとめ の各スライド内容から画像プロンプトを自動生成し、
              スライド内に埋め込みます。 cards / table / quote 等は対象外です。
            </div>
            {illustrationProgress && (
              <div className="mt-1 text-xs text-navy-700">
                画像生成中… {illustrationProgress.done}/{illustrationProgress.total}: {illustrationProgress.title}
              </div>
            )}
          </div>
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">テーマ:</span>
          {(Object.keys(THEMES) as ThemeId[]).map((id) => (
            <label
              key={id}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition ${
                settings.theme === id
                  ? "border-navy-700 bg-navy-50 text-navy-900 dark:bg-navy-900/40 dark:text-white"
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
              }`}
            >
              <input
                type="radio"
                name="theme"
                value={id}
                checked={settings.theme === id}
                onChange={() => setTheme(id)}
                className="sr-only"
              />
              {THEMES[id].label}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {generating && (
            <button
              type="button"
              className="btn-outline px-4 py-3 text-sm"
              onClick={handleCancel}
            >
              ⏹ キャンセル
            </button>
          )}
          <button
            type="button"
            className="btn-primary px-8 py-3 text-lg"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                生成中… {formatElapsed(elapsedSec)}
              </span>
            ) : (
              "▶ 生成"
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

function stripCodeFence(s: string): string {
  return s
    .replace(/^\s*```(?:markdown|md)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}
