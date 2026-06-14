"use client";

import { create } from "zustand";
import { STORAGE_KEYS } from "./constants";

export interface EQBand {
  frequency: number; // Hz
  label: string;
  gain: number; // -12 to +12 dB
}

export type EQPresetName =
  | "normal"
  | "pop"
  | "rock"
  | "classical"
  | "jazz"
  | "dance"
  | "vocal"
  | "custom";

export const EQ_BANDS: Omit<EQBand, "gain">[] = [
  { frequency: 32, label: "32" },
  { frequency: 64, label: "64" },
  { frequency: 125, label: "125" },
  { frequency: 250, label: "250" },
  { frequency: 500, label: "500" },
  { frequency: 1000, label: "1K" },
  { frequency: 2000, label: "2K" },
  { frequency: 4000, label: "4K" },
  { frequency: 8000, label: "8K" },
  { frequency: 16000, label: "16K" },
];

export const EQ_PRESETS: Record<EQPresetName, number[]> = {
  normal: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  pop: [-1, 0, 1, 2, 2, 0, -1, -1, 0, 0],
  rock: [3, 2, 1, 0, -1, -2, -1, 0, 2, 3],
  classical: [3, 3, 2, 1, -1, -2, -1, 0, 1, 2],
  jazz: [2, 2, 1, 1, 0, -1, -1, 0, 1, 1],
  dance: [4, 3, 2, 0, -1, -2, -2, 0, 2, 3],
  vocal: [-2, -1, 0, 2, 3, 3, 2, 1, 0, -1],
  custom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

function getDefaultBands(): EQBand[] {
  return EQ_BANDS.map((b, i) => ({ ...b, gain: 0 }));
}

function loadPreset(): EQPresetName {
  if (typeof window === "undefined") return "normal";
  try {
    const stored = localStorage.getItem("flowsound_eq_preset");
    if (stored && stored in EQ_PRESETS) return stored as EQPresetName;
  } catch {
    // ignore
  }
  return "normal";
}

function loadBands(): EQBand[] {
  if (typeof window === "undefined") return getDefaultBands();
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.eqSettings);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return getDefaultBands();
}

interface EQStore {
  enabled: boolean;
  bands: EQBand[];
  preset: EQPresetName;
  toggleEQ: () => void;
  setBand: (index: number, gain: number) => void;
  setPreset: (preset: EQPresetName) => void;
  resetBands: () => void;
}

export const useEQStore = create<EQStore>((set, get) => ({
  enabled: false,
  bands: loadBands(),
  preset: loadPreset(),

  toggleEQ: () => set((s) => ({ enabled: !s.enabled })),

  setBand: (index: number, gain: number) => {
    const bands = get().bands.map((b, i) =>
      i === index ? { ...b, gain: Math.max(-12, Math.min(12, gain)) } : b
    );
    localStorage.setItem(STORAGE_KEYS.eqSettings, JSON.stringify(bands));
    set({ bands, preset: "custom" });
  },

  setPreset: (preset: EQPresetName) => {
    const gains = EQ_PRESETS[preset];
    const bands = EQ_BANDS.map((b, i) => ({ ...b, gain: gains[i] ?? 0 }));
    localStorage.setItem(STORAGE_KEYS.eqSettings, JSON.stringify(bands));
    localStorage.setItem("flowsound_eq_preset", preset);
    set({ bands, preset });
  },

  resetBands: () => {
    const bands = getDefaultBands();
    localStorage.setItem(STORAGE_KEYS.eqSettings, JSON.stringify(bands));
    localStorage.setItem("flowsound_eq_preset", "normal");
    set({ bands, preset: "normal" });
  },
}));
