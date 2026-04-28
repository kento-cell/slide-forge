import type { ThemeId } from "../types";

export interface ThemeColors {
  bg: string;
  bgAlt: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryDark: string;
  accent: string;
  border: string;
  good: string;
  bad: string;
}

export interface Theme {
  id: ThemeId;
  label: string;
  fontHead: string;
  fontBody: string;
  colors: ThemeColors;
}

export const THEMES: Record<ThemeId, Theme> = {
  navy: {
    id: "navy",
    label: "Navy (落ち着き)",
    fontHead: "Yu Mincho",
    fontBody: "Yu Gothic",
    colors: {
      bg: "FFFFFF",
      bgAlt: "EAF1FA",
      text: "1A1A1A",
      textMuted: "5A5A5A",
      primary: "1B3A6B",
      primaryDark: "0B1F3F",
      accent: "ED6C02",
      border: "D0D0D0",
      good: "2E7D32",
      bad: "C62828",
    },
  },
  light: {
    id: "light",
    label: "Light (明るい)",
    fontHead: "Yu Gothic",
    fontBody: "Yu Gothic",
    colors: {
      bg: "FFFFFF",
      bgAlt: "F5F7FA",
      text: "0F172A",
      textMuted: "64748B",
      primary: "0EA5E9",
      primaryDark: "0369A1",
      accent: "F59E0B",
      border: "E2E8F0",
      good: "10B981",
      bad: "EF4444",
    },
  },
  mono: {
    id: "mono",
    label: "Mono (モノトーン)",
    fontHead: "Yu Mincho",
    fontBody: "Yu Gothic",
    colors: {
      bg: "FFFFFF",
      bgAlt: "F4F4F5",
      text: "18181B",
      textMuted: "71717A",
      primary: "27272A",
      primaryDark: "09090B",
      accent: "FACC15",
      border: "D4D4D8",
      good: "16A34A",
      bad: "DC2626",
    },
  },
};
