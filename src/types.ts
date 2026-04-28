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
  | "summary";

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

export type Slide =
  | CoverSlide
  | BulletsSlide
  | TwoColumnSlide
  | TableSlide
  | QuoteSlide
  | SummarySlide;

export interface Deck {
  title: string;
  slides: Slide[];
}
