import { useCallback, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { DEFAULT_PROMPT } from "../samples/defaultPrompt";
import { THEMES } from "../pptx/themes";
import { callLLM } from "../providers";
import { SYSTEM_PROMPT, buildUserPrompt } from "../lib/llmPrompt";
import { parseMarkdown } from "../md/parser";
import type { ThemeId } from "../types";

export function Main() {
  const settings = useAppStore((s) => s.settings);
  const setTheme = useAppStore((s) => s.setTheme);
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

  const displayValue = promptTouched ? prompt : DEFAULT_PROMPT;
  const isOffline = settings.provider.id === "offline";

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

  async function handleGenerate() {
    setError(null);
    const userInput = (promptTouched ? prompt : DEFAULT_PROMPT).trim();
    if (!userInput) {
      setError("プロンプトを入力してください");
      return;
    }
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
      setError(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
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
        <button
          type="button"
          className="btn-primary px-8 py-3 text-lg"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? "生成中…" : "▶ 生成"}
        </button>
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
