export type ProviderId =
  | "gemini"
  | "groq"
  | "anthropic"
  | "openai"
  | "ollama"
  | "offline";

export interface ProviderConfig {
  id: ProviderId;
  apiKey?: string;
  model?: string;
  endpoint?: string;
}

export type ThemeId = "navy" | "light" | "mono";

export interface AppSettings {
  provider: ProviderConfig;
  theme: ThemeId;
  setupDone: boolean;
}

export type Screen = "wizard" | "main" | "result";

export type SlideKind =
  | "cover"
  | "bullets"
  | "two-column"
  | "table"
  | "quote"
  | "summary"
  | "section"
  | "stat"
  | "image"
  | "process"
  | "cards";

/** Optional auto-illustration metadata. The renderer places the image
 *  in a slide-type-specific position when present. */
export interface SlideImageEmbed {
  dataUrl: string;
  width: number;
  height: number;
  alt?: string;
}

export interface CoverSlide {
  kind: "cover";
  title: string;
  subtitle?: string;
  tagline?: string;
  image?: SlideImageEmbed;
}
export interface BulletsSlide {
  kind: "bullets";
  title: string;
  items: string[];
  image?: SlideImageEmbed;
}
export interface TwoColumnSlide {
  kind: "two-column";
  title: string;
  left: { heading?: string; items: string[] };
  right: { heading?: string; items: string[] };
}
export interface TableSlide {
  kind: "table";
  title: string;
  headers: string[];
  rows: string[][];
}
export interface QuoteSlide {
  kind: "quote";
  title?: string;
  quote: string;
  cite?: string;
}
export interface SummarySlide {
  kind: "summary";
  title: string;
  items: string[];
  image?: SlideImageEmbed;
}
export interface SectionSlide {
  kind: "section";
  /** Big two-digit chapter index, e.g. "01". */
  index: string;
  title: string;
  subtitle?: string;
  image?: SlideImageEmbed;
}
export interface StatSlide {
  kind: "stat";
  /** Big headline number, e.g. "30%" or "¥1.2B". */
  value: string;
  /** Caption under the number, e.g. "前年比成長率". */
  label: string;
  /** Optional supporting text below the caption. */
  detail?: string;
}
export interface ImageSlide {
  kind: "image";
  title: string;
  /** Browser-normalized PNG data URL. Original metadata is stripped. */
  dataUrl: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
}
export interface ProcessSlide {
  kind: "process";
  title: string;
  /** Ordered steps shown as arrow-connected boxes (3-5 items). */
  steps: { label: string; detail?: string }[];
}
export interface CardsSlide {
  kind: "cards";
  title: string;
  /** Side-by-side cards (3 items). Each card is a colored block
   *  with a heading and a short description. */
  cards: { heading: string; body: string }[];
}

export type Slide =
  | CoverSlide
  | BulletsSlide
  | TwoColumnSlide
  | TableSlide
  | QuoteSlide
  | SummarySlide
  | SectionSlide
  | StatSlide
  | ImageSlide
  | ProcessSlide
  | CardsSlide;

export interface Deck {
  title: string;
  slides: Slide[];
}
