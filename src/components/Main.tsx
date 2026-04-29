import { useCallback, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { DEFAULT_PROMPT, OFFLINE_SAMPLE_MARKDOWN } from "../samples/defaultPrompt";
import { THEMES } from "../pptx/themes";
import { callLLM } from "../providers";
import { SYSTEM_PROMPT, buildUserPrompt } from "../lib/llmPrompt";
import { parseMarkdown } from "../md/parser";
import { useElapsedSec, formatElapsed } from "../lib/useElapsedSec";
import type { ThemeId } from "../types";

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

  const isOffline = settings.provider.id === "offline";
  // Offline mode parses the textarea as Markdown directly, so the
  // sample shown when the user hasn't typed anything must be real
  // Markdown (with # / ## headers), not the AI task prompt that has
  // headers documented inside a code-fence-like description.
  const sampleForCurrentMode = isOffline ? OFFLINE_SAMPLE_MARKDOWN : DEFAULT_PROMPT;
  const displayValue = promptTouched ? prompt : sampleForCurrentMode;

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const file = Array.from(files).find((f) =>
        /\.(md|markdown|txt)$/i.test(f.name),
      );
      if (!file) {
        setError(".md / .markdown / .txt のいずれかを投入してください");
        return;
      }
      const text = await file.text();
      setPrompt(text, true);
      setError(null);
    },
    [setPrompt, setError],
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
      const deck = parseMarkdown(cleaned);
      if (deck.slides.length === 0) {
        throw new Error(
          "スライドを抽出できませんでした。# / ## の見出しを使ってください。",
        );
      }
      setDeck(deck, cleaned);
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
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <button
          type="button"
          onClick={resetSetup}
          className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:border-navy-400 hover:bg-navy-50 hover:text-navy-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-navy-500 dark:hover:bg-slate-800"
        >
          ← モード選択に戻る
        </button>
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
          <span>📁 .md / .txt をドラッグ&ドロップ もしくは下に直接入力</span>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
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
