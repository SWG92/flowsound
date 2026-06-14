"use client";

import { create } from "zustand";
import { STORAGE_KEYS, MAX_SEARCH_HISTORY } from "./constants";

interface SearchStore {
  history: string[];
  addToHistory: (query: string) => void;
  removeFromHistory: (query: string) => void;
  clearHistory: () => void;
}

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.searchHistory);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.searchHistory, JSON.stringify(history));
  } catch {
    // ignore
  }
}

export const useSearchStore = create<SearchStore>((set, get) => ({
  history: loadHistory(),

  addToHistory: (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const { history } = get();
    const filtered = history.filter((h) => h !== trimmed);
    const newHistory = [trimmed, ...filtered].slice(0, MAX_SEARCH_HISTORY);
    saveHistory(newHistory);
    set({ history: newHistory });
  },

  removeFromHistory: (query: string) => {
    const newHistory = get().history.filter((h) => h !== query);
    saveHistory(newHistory);
    set({ history: newHistory });
  },

  clearHistory: () => {
    saveHistory([]);
    set({ history: [] });
  },
}));
