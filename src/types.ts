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

export type ThemeId =
  | "navy"
  | "light"
  | "mono"
  | "warm"
  | "cool"
  | "forest"
  | "playful";

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
  | "cards"
  | "compare"
  | "layered"
  | "progress"
  | "chart"
  | "mockup";

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
  caption?: string;
}
export interface TwoColumnSlide {
  kind: "two-column";
  title: string;
  left: { heading?: string; items: string[] };
  right: { heading?: string; items: string[] };
  caption?: string;
}
export interface TableSlide {
  kind: "table";
  title: string;
  headers: string[];
  rows: string[][];
  caption?: string;
}
export interface QuoteSlide {
  kind: "quote";
  title?: string;
  quote: string;
  cite?: string;
  caption?: string;
}
export interface SummarySlide {
  kind: "summary";
  title: string;
  items: string[];
  image?: SlideImageEmbed;
  caption?: string;
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
  caption?: string;
}
export interface CardsSlide {
  kind: "cards";
  title: string;
  /** Side-by-side cards (3 items). Each card is a colored block
   *  with a heading and a short description. */
  cards: { heading: string; body: string }[];
  caption?: string;
}

/** Before → arrow → After comparison. Two cards with a center arrow.
 *  Use to highlight transformation, contrast old vs new, etc. */
export interface CompareSlide {
  kind: "compare";
  title: string;
  left: { heading: string; items: string[]; tone?: "bad" | "neutral" };
  right: { heading: string; items: string[]; tone?: "good" | "neutral" };
  arrowLabel?: string;
  caption?: string;
}

/** Layered architecture / hierarchy diagram. Stacked rounded rects
 *  (3-5 layers), each with a numbered badge, heading and detail. */
export interface LayeredSlide {
  kind: "layered";
  title: string;
  layers: { heading: string; detail?: string }[];
  caption?: string;
}

/** Progress bar + state-card grid. Used for roadmap / phase tracking. */
export interface ProgressSlide {
  kind: "progress";
  title: string;
  /** Overall progress percent 0..100. */
  percent: number;
  /** Phase / item cards rendered in a grid below the bar. */
  items: { label: string; state: "done" | "next" | "todo"; note?: string }[];
  caption?: string;
}

/** Native pptxgenjs chart. Renders as an editable chart object. */
export interface ChartSlide {
  kind: "chart";
  title: string;
  chartType: "bar" | "line" | "pie" | "doughnut";
  /** X-axis category labels (or pie slice labels). */
  labels: string[];
  /** Each series has a name and one value per label. */
  series: { name: string; values: number[] }[];
  caption?: string;
}

/** Browser / PDF / phone mockup with content. */
export interface MockupSlide {
  kind: "mockup";
  title: string;
  mockupType: "browser" | "pdf" | "phone";
  /** Title bar text shown in the mockup chrome. */
  url?: string;
  /** Body lines rendered inside the mockup viewport. */
  bodyLines: string[];
  caption?: string;
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
  | CardsSlide
  | CompareSlide
  | LayeredSlide
  | ProgressSlide
  | ChartSlide
  | MockupSlide;

export interface Deck {
  title: string;
  slides: Slide[];
}
