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
  | "image";

export interface CoverSlide {
  kind: "cover";
  title: string;
  subtitle?: string;
  tagline?: string;
}
export interface BulletsSlide {
  kind: "bullets";
  title: string;
  items: string[];
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
}
export interface SectionSlide {
  kind: "section";
  /** Big two-digit chapter index, e.g. "01". */
  index: string;
  title: string;
  subtitle?: string;
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

export type Slide =
  | CoverSlide
  | BulletsSlide
  | TwoColumnSlide
  | TableSlide
  | QuoteSlide
  | SummarySlide
  | SectionSlide
  | StatSlide
  | ImageSlide;

export interface Deck {
  title: string;
  slides: Slide[];
}
