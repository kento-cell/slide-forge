/**
 * Per-slide auto-illustration. Walks through a parsed Deck, builds a
 * content-aware image prompt for each illustratable slide, generates
 * via the user's configured cloud provider, and embeds the result
 * back into the deck via the optional `image` field.
 *
 * Illustrated slide types: cover / bullets / section / summary.
 * Skipped types: stat / table / quote / two-column / process / cards
 *   — these are already visually rich on their own; adding background
 *   imagery would muddy them.
 */

import type { Deck, Slide, SlideImageEmbed } from "../types";
import { generateImage, isImageGenSupported } from "./imageGen";
import type { ProviderConfig } from "../types";

export type IllustrationProgress = (
  done: number,
  total: number,
  currentTitle: string,
) => void;

/** Slide kinds that get auto-illustrated. */
const ILLUSTRATABLE: ReadonlySet<Slide["kind"]> = new Set([
  "cover",
  "bullets",
  "section",
  "summary",
]);

/** Counts how many slides in `deck` would receive an image. */
export function countIllustratable(deck: Deck): number {
  return deck.slides.filter((s) => ILLUSTRATABLE.has(s.kind)).length;
}

/** Build a single-line image-gen prompt from a slide's content. The
 *  goal is "an evocative scene that supports the slide's theme without
 *  literal characters or branded imagery". */
function buildPromptFor(slide: Slide, deckTitle: string): string {
  // Visual style guard — appended to every prompt to keep output
  // consistent with a presentation-friendly aesthetic. Avoids
  // copyrighted styles, characters, brand logos.
  const styleGuard =
    "イラストのみ、文字・ロゴ・人物の顔・特定キャラクターは描かない。" +
    "やわらかい水彩タッチ、淡いパステル、抽象的で象徴的なモチーフ。" +
    "16:9 横長、プレゼンスライドの背景イメージとして使える落ち着いた構図。";

  switch (slide.kind) {
    case "cover":
      return [
        `プレゼン「${deckTitle}」のカバー用イメージ。`,
        slide.subtitle ? `テーマ: ${slide.subtitle}` : "",
        slide.tagline ? `補足: ${slide.tagline}` : "",
        styleGuard,
      ]
        .filter(Boolean)
        .join("\n");
    case "bullets":
      return [
        `スライドタイトル: ${slide.title}`,
        `ポイント: ${slide.items.slice(0, 3).join(" / ")}`,
        styleGuard,
      ].join("\n");
    case "section":
      return [
        `章扉「${slide.index} ${slide.title}」の象徴イメージ。`,
        slide.subtitle ? `補足: ${slide.subtitle}` : "",
        styleGuard,
      ]
        .filter(Boolean)
        .join("\n");
    case "summary":
      return [
        `まとめスライド「${slide.title}」の象徴イメージ。`,
        `要点: ${slide.items.slice(0, 3).join(" / ")}`,
        styleGuard,
      ].join("\n");
    default:
      return `${slide.kind} スライドのイメージ。${styleGuard}`;
  }
}

/** Image generation function signature used by autoIllustrateDeck.
 *  Defaults to the real `generateImage` from imageGen.ts; overridable
 *  for tests / non-default providers. */
export type ImageGenerator = (
  provider: ProviderConfig,
  prompt: string,
  signal?: AbortSignal,
) => Promise<{ dataUrl: string; width: number; height: number }>;

export interface AutoIllustrateOptions {
  signal?: AbortSignal;
  onProgress?: IllustrationProgress;
  /** If true, each failure (rate-limit, content moderation, etc.) is
   *  swallowed and the slide stays without an image. If false, the
   *  first failure aborts the whole run. Defaults to true so a single
   *  bad prompt doesn't lose the rest of the work. */
  continueOnError?: boolean;
  /** Override the default image generator. Used by tests. */
  imageGenerator?: ImageGenerator;
}

export interface AutoIllustrateResult {
  deck: Deck;
  illustrated: number;
  skipped: number;
  failures: { title: string; error: string }[];
}

/** Mutate a copy of `deck` with auto-generated images embedded. */
export async function autoIllustrateDeck(
  deck: Deck,
  provider: ProviderConfig,
  opts: AutoIllustrateOptions = {},
): Promise<AutoIllustrateResult> {
  if (!isImageGenSupported(provider.id)) {
    throw new Error(
      `現在のプロバイダ ${provider.id} は画像生成に対応していません。Gemini か OpenAI に切替えてください。`,
    );
  }

  const continueOnError = opts.continueOnError !== false;
  const imageGenerator = opts.imageGenerator ?? generateImage;
  const total = countIllustratable(deck);
  const newSlides: Slide[] = [];
  const failures: AutoIllustrateResult["failures"] = [];
  let illustrated = 0;
  let progressIndex = 0;

  for (const slide of deck.slides) {
    // Narrow to the four kinds that have an `image` field. The
    // ILLUSTRATABLE set above and this typeguard MUST stay in sync —
    // a kind in ILLUSTRATABLE that this guard rejects would silently
    // skip its slide.
    if (
      slide.kind !== "cover" &&
      slide.kind !== "bullets" &&
      slide.kind !== "section" &&
      slide.kind !== "summary"
    ) {
      newSlides.push(slide);
      continue;
    }
    progressIndex += 1;
    const prompt = buildPromptFor(slide, deck.title);
    const rawTitle = "title" in slide ? slide.title : "";
    const slideTitle = rawTitle || slide.kind;
    opts.onProgress?.(progressIndex - 1, total, slideTitle);
    try {
      const generated = await imageGenerator(provider, prompt, opts.signal);
      const embed: SlideImageEmbed = {
        dataUrl: generated.dataUrl,
        width: generated.width,
        height: generated.height,
        alt: slideTitle,
      };
      // The narrowing above guarantees `slide` is one of the four
      // illustratable shapes; TS happily accepts the spread now.
      newSlides.push({ ...slide, image: embed });
      illustrated += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ title: slideTitle, error: message });
      if (!continueOnError) {
        opts.onProgress?.(progressIndex, total, slideTitle);
        throw err;
      }
      // Keep slide without image on failure.
      newSlides.push(slide);
    }
  }

  opts.onProgress?.(total, total, "完了");
  return {
    deck: { ...deck, slides: newSlides },
    illustrated,
    skipped: total - illustrated - failures.length,
    failures,
  };
}
