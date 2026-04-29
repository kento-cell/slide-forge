import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { THEMES } from "../pptx/themes";
import { callLLM } from "../providers";
import { SYSTEM_PROMPT, buildUserPrompt } from "../lib/llmPrompt";
import { parseMarkdown } from "../md/parser";
import { DEFAULT_PROMPT, OFFLINE_SAMPLE_MARKDOWN } from "../samples/defaultPrompt";
import { useElapsedSec, formatElapsed } from "../lib/useElapsedSec";
import type { Slide } from "../types";

export function Result() {
  const deck = useAppStore((s) => s.deck);
  const settings = useAppStore((s) => s.settings);
  const setScreen = useAppStore((s) => s.setScreen);
  const setDeck = useAppStore((s) => s.setDeck);
  const prompt = useAppStore((s) => s.prompt);
  const promptTouched = useAppStore((s) => s.promptTouched);
  const generating = useAppStore((s) => s.generating);
  const setGenerating = useAppStore((s) => s.setGenerating);
  const error = useAppStore((s) => s.error);
  const setError = useAppStore((s) => s.setError);
  const rawMarkdown = useAppStore((s) => s.rawMarkdown);
  const [showMd, setShowMd] = useState(false);
  const [downloadCount, setDownloadCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const elapsedSec = useElapsedSec(generating);
  const REGEN_TIMEOUT_MS = 5 * 60 * 1000;

  const theme = useMemo(() => THEMES[settings.theme], [settings.theme]);

  useEffect(() => {
    if (!deck) setScreen("main");
  }, [deck, setScreen]);

  if (!deck) return null;

  async function handleDownload() {
    setError(null);
    try {
      if (!deck) return;
      // Lazy-load the PPTX generator (and the heavyweight pptxgenjs
      // dependency it pulls in) only when the user actually clicks
      // download — keeps the initial bundle under the Vite 500 KB
      // warning threshold.
      const { generatePptx } = await import("../pptx/generator");
      const blob = await generatePptx(deck, settings.theme);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safe = deck.title.replace(/[^\w\u3000-\u9fff\-_ ]/g, "_").trim() || "deck";
      a.href = url;
      a.download = `${safe}.pptx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDownloadCount((c) => c + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "DL に失敗しました");
    }
  }

  function handleCancelRegen() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }

  async function handleRegenerate() {
    if (settings.provider.id === "offline") {
      const text = (promptTouched ? prompt : OFFLINE_SAMPLE_MARKDOWN).trim();
      const next = parseMarkdown(text);
      setDeck(next, text);
      return;
    }

    handleCancelRegen();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = window.setTimeout(() => {
      controller.abort(new DOMException("timeout", "TimeoutError"));
    }, REGEN_TIMEOUT_MS);

    setError(null);
    setGenerating(true);
    try {
      const text = (promptTouched ? prompt : DEFAULT_PROMPT).trim();
      const md = await callLLM(
        settings.provider,
        SYSTEM_PROMPT,
        buildUserPrompt(text),
        controller.signal,
      );
      const cleaned = md
        .replace(/^\s*```(?:markdown|md)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const next = parseMarkdown(cleaned);
      if (next.slides.length === 0) throw new Error("スライドを抽出できませんでした");
      setDeck(next, cleaned);
    } catch (e) {
      if (controller.signal.aborted) {
        const reason = controller.signal.reason;
        if (reason instanceof DOMException && reason.name === "TimeoutError") {
          setError(
            `再生成が ${REGEN_TIMEOUT_MS / 60000} 分以内に完了しませんでした。`,
          );
        } else {
          setError("キャンセルしました");
        }
      } else {
        setError(e instanceof Error ? e.message : "再生成に失敗しました");
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (abortRef.current === controller) abortRef.current = null;
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <button
            onClick={() => setScreen("main")}
            className="mb-2 text-sm text-slate-500 hover:underline"
          >
            ← 編集に戻る
          </button>
          <h1 className="font-head text-2xl font-bold">{deck.title}</h1>
          <p className="text-sm text-slate-500">
            {deck.slides.length} 枚 · テーマ: {theme.label}
            {downloadCount > 0 && ` · DL ${downloadCount} 回`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-outline" onClick={() => setShowMd((v) => !v)}>
            {showMd ? "プレビュー" : "Markdown を見る"}
          </button>
          {generating ? (
            <>
              <span className="inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-navy-700" />
                再生成中… {formatElapsed(elapsedSec)}
              </span>
              <button
                className="btn-outline"
                onClick={handleCancelRegen}
              >
                ⏹ キャンセル
              </button>
            </>
          ) : (
            <button
              className="btn-outline"
              onClick={handleRegenerate}
            >
              ♻ 再生成
            </button>
          )}
          <button className="btn-primary" onClick={handleDownload}>
            ⬇ PPTX をダウンロード
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showMd ? (
        <pre className="card max-h-[70vh] overflow-auto whitespace-pre-wrap p-6 font-mono text-sm leading-relaxed">
          {rawMarkdown}
        </pre>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {deck.slides.map((slide, i) => (
            <SlideThumb key={i} slide={slide} index={i} total={deck.slides.length} />
          ))}
        </div>
      )}
    </div>
  );
}

function SlideThumb({
  slide,
  index,
  total,
}: {
  slide: Slide;
  index: number;
  total: number;
}) {
  const settings = useAppStore((s) => s.settings);
  const theme = THEMES[settings.theme];
  const isCover = slide.kind === "cover";
  return (
    <div
      className="card aspect-[16/9] overflow-hidden p-3"
      style={{
        background: isCover ? `#${theme.colors.primaryDark}` : `#${theme.colors.bg}`,
        color: isCover ? "#FFFFFF" : `#${theme.colors.text}`,
      }}
    >
      <div className="flex h-full flex-col">
        {!isCover && (
          <div
            className="border-b pb-1 text-[10px] font-bold uppercase tracking-wider"
            style={{
              borderColor: `#${theme.colors.primary}`,
              color: `#${theme.colors.primary}`,
            }}
          >
            {"title" in slide && slide.title}
          </div>
        )}
        <div className="mt-1 flex-1 overflow-hidden text-[11px] leading-snug">
          {renderThumbBody(slide)}
        </div>
        <div
          className="text-right text-[9px]"
          style={{ color: isCover ? "#EAF1FA" : `#${theme.colors.textMuted}` }}
        >
          {index + 1} / {total}
        </div>
      </div>
    </div>
  );
}

function renderThumbBody(slide: Slide) {
  switch (slide.kind) {
    case "cover":
      return (
        <div className="flex h-full flex-col justify-center">
          <div className="text-base font-bold leading-tight">{slide.title}</div>
          {slide.subtitle && <div className="mt-1 text-[10px] opacity-80">{slide.subtitle}</div>}
          {slide.tagline && <div className="mt-2 text-[10px] opacity-70">{slide.tagline}</div>}
        </div>
      );
    case "bullets":
    case "summary":
      return (
        <ul className="space-y-1">
          {slide.items.slice(0, 6).map((it, i) => (
            <li key={i} className="truncate">· {it}</li>
          ))}
        </ul>
      );
    case "two-column":
      return (
        <div className="grid grid-cols-2 gap-2">
          <ul className="space-y-1">
            {slide.left.heading && <li className="font-bold">{slide.left.heading}</li>}
            {slide.left.items.slice(0, 4).map((it, i) => (
              <li key={i} className="truncate">· {it}</li>
            ))}
          </ul>
          <ul className="space-y-1">
            {slide.right.heading && <li className="font-bold">{slide.right.heading}</li>}
            {slide.right.items.slice(0, 4).map((it, i) => (
              <li key={i} className="truncate">· {it}</li>
            ))}
          </ul>
        </div>
      );
    case "table":
      return (
        <table className="w-full text-[9px]">
          <thead>
            <tr>
              {slide.headers.map((h, i) => (
                <th key={i} className="border-b text-left font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slide.rows.slice(0, 4).map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className="truncate pr-1">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "quote":
      return (
        <div className="flex h-full items-center text-[12px] italic">
          “{slide.quote}”
        </div>
      );
  }
}
