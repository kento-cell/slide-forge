import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { THEMES } from "../pptx/themes";
import { callLLM } from "../providers";
import { SYSTEM_PROMPT, buildUserPrompt } from "../lib/llmPrompt";
import { parseMarkdown } from "../md/parser";
import { DEFAULT_PROMPT } from "../samples/defaultPrompt";
import { useElapsedSec, formatElapsed } from "../lib/useElapsedSec";
import { BackButton } from "./BackButton";
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

  const isOffline = settings.provider.id === "offline";

  async function handleRegenerate() {
    if (isOffline) {
      // Offline mode parses Markdown deterministically — clicking
      // regenerate without editing the prompt would reproduce the
      // SAME deck, leading users to think the button is broken.
      // Send them back to Main so they edit before re-rendering.
      setError("AI なしモードでは Markdown を編集してから再生成してください");
      setScreen("main");
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
      // Force a visibly different deck on regenerate. Without this
      // hint the LLM tends to land on the same titles + structure
      // because its sampling temperature is fixed and the input
      // prompt is identical. Appending an explicit "do it differently"
      // instruction shakes the output without losing fidelity to the
      // user's original intent.
      const regenHint =
        "\n\n[再生成依頼]\n前回とは構成・章立て・例示の数値・スライドタイトルを大きく変えて、" +
        "同じテーマを別の切り口で再構成してください。SECTION の章タイトル、STAT の数値の見せ方、" +
        "FLOW の段階分け、CARDS の3要素は前回と必ず異なるものを選んでください。";
      const md = await callLLM(
        settings.provider,
        SYSTEM_PROMPT,
        buildUserPrompt(text + regenHint),
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
          <BackButton onClick={() => setScreen("main")} label="編集に戻る" topNav />
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
              title={
                isOffline
                  ? "AI なしモードでは Markdown 編集後に反映されます"
                  : "同じプロンプトで別のバリエーションを生成"
              }
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
  // Cover and section dividers both render on the dark hero background
  // in the PPTX output, so the thumbnail mirrors that.
  const isHero = slide.kind === "cover" || slide.kind === "section";
  // Stat slides have no title chrome — the value IS the title — so
  // suppress the header band in the thumbnail too.
  const showHeader = !isHero && slide.kind !== "stat";
  return (
    <div
      className="card aspect-[16/9] overflow-hidden p-3"
      style={{
        background: isHero ? `#${theme.colors.primaryDark}` : `#${theme.colors.bg}`,
        color: isHero ? "#FFFFFF" : `#${theme.colors.text}`,
      }}
    >
      <div className="flex h-full flex-col">
        {showHeader && (
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
          style={{ color: isHero ? "#EAF1FA" : `#${theme.colors.textMuted}` }}
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
        <div className="flex h-full gap-1">
          <ul className="flex-1 space-y-1 overflow-hidden">
            {slide.items.slice(0, 6).map((it, i) => (
              <li key={i} className="truncate">· {it}</li>
            ))}
          </ul>
          {slide.image && (
            <img
              src={slide.image.dataUrl}
              alt={slide.image.alt ?? ""}
              className="aspect-square h-full max-w-[40%] rounded-sm object-cover"
            />
          )}
        </div>
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
    case "section":
      return (
        <div className="flex h-full flex-col justify-center">
          <div className="text-[7px] font-bold opacity-70 tracking-widest">CHAPTER</div>
          <div className="text-3xl font-extrabold leading-none">{slide.index}</div>
          <div className="mt-1 text-[10px] font-bold">{slide.title}</div>
          {slide.subtitle && (
            <div className="mt-0.5 text-[8px] opacity-70">{slide.subtitle}</div>
          )}
        </div>
      );
    case "stat":
      return (
        <div className="flex h-full flex-col items-center justify-center">
          <div className="text-3xl font-extrabold leading-none">{slide.value}</div>
          <div className="mt-1 text-[10px] font-bold">{slide.label}</div>
          {slide.detail && (
            <div className="mt-0.5 text-[8px] opacity-70 truncate">{slide.detail}</div>
          )}
        </div>
      );
    case "image":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1">
          <img
            src={slide.dataUrl}
            alt={slide.alt}
            className="max-h-[90%] max-w-full rounded-sm object-contain"
          />
          {slide.caption && (
            <div className="max-w-full truncate text-[8px] opacity-70">
              {slide.caption}
            </div>
          )}
        </div>
      );
    case "process":
      return (
        <div className="flex h-full items-center justify-center gap-1">
          {slide.steps.slice(0, 5).map((step, i) => (
            <div key={i} className="flex items-center gap-0.5">
              <div className="flex flex-col items-center rounded border border-current px-1 py-0.5">
                <div className="text-[7px] font-bold">{String(i + 1).padStart(2, "0")}</div>
                <div className="max-w-[3em] truncate text-[8px]">{step.label}</div>
              </div>
              {i < slide.steps.length - 1 && i < 4 && (
                <span className="text-[10px]">▶</span>
              )}
            </div>
          ))}
        </div>
      );
    case "cards":
      return (
        <div className="grid h-full grid-cols-3 gap-1">
          {slide.cards.slice(0, 3).map((card, i) => (
            <div
              key={i}
              className="flex flex-col rounded border border-current p-1"
            >
              <div className="text-[7px] font-bold">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="truncate text-[9px] font-bold">{card.heading}</div>
              <div className="truncate text-[7px] opacity-70">{card.body}</div>
            </div>
          ))}
        </div>
      );
  }
}
