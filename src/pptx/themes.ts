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
  warm: {
    id: "warm",
    label: "Warm (暖色)",
    fontHead: "Yu Mincho",
    fontBody: "Yu Gothic",
    colors: {
      bg: "FFFFFF",
      bgAlt: "FFF4E5",
      text: "1F1109",
      textMuted: "8B6F5C",
      primary: "D84315",
      primaryDark: "8B1A00",
      accent: "F9A825",
      border: "F4D9A8",
      good: "7CB342",
      bad: "B71C1C",
    },
  },
  cool: {
    id: "cool",
    label: "Cool (寒色)",
    fontHead: "Yu Mincho",
    fontBody: "Yu Gothic",
    colors: {
      bg: "FFFFFF",
      bgAlt: "E0F2F1",
      text: "0D2C2E",
      textMuted: "4D6F71",
      primary: "00695C",
      primaryDark: "00372E",
      accent: "4FC3F7",
      border: "B2DFDB",
      good: "388E3C",
      bad: "D32F2F",
    },
  },
  forest: {
    id: "forest",
    label: "Forest (深緑+ゴールド)",
    fontHead: "Yu Mincho",
    fontBody: "Yu Gothic",
    colors: {
      bg: "FFFFFF",
      bgAlt: "EEEDE8",
      text: "1F1F1A",
      textMuted: "5C5C50",
      primary: "2D4A22",
      primaryDark: "1A2B14",
      accent: "D4A24A",
      border: "D6D3CC",
      good: "7CB342",
      bad: "8B0000",
    },
  },
  playful: {
    id: "playful",
    label: "Playful (ピンク+紫)",
    fontHead: "Yu Gothic",
    fontBody: "Yu Gothic",
    colors: {
      bg: "FFFFFF",
      bgAlt: "FCE4EC",
      text: "2A0A1F",
      textMuted: "7A5468",
      primary: "C2185B",
      primaryDark: "7B0E3A",
      accent: "8E24AA",
      border: "F8BBD0",
      good: "26A69A",
      bad: "D81B60",
    },
  },
};
