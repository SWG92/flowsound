"use client";

import { create } from "zustand";

interface NavHistoryState {
  stack: string[];       // 历史栈
  currentIndex: number;  // 当前位置
  push: (path: string) => void;
  goBack: () => string | null;
  goForward: () => string | null;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
}

export const useNavHistory = create<NavHistoryState>((set, get) => ({
  stack: [],
  currentIndex: -1,

  push: (path) => {
    const { stack, currentIndex } = get();
    // 去掉当前 index 之后的记录（前进后跳转新页面，清空前进栈）
    const trimmed = stack.slice(0, currentIndex + 1);
    // 不重复记录相同路径
    if (trimmed[trimmed.length - 1] === path) return;
    const newStack = [...trimmed, path];
    set({ stack: newStack, currentIndex: newStack.length - 1 });
  },

  goBack: () => {
    const { stack, currentIndex } = get();
    if (currentIndex <= 0) return null;
    const newIndex = currentIndex - 1;
    set({ currentIndex: newIndex });
    return stack[newIndex];
  },

  goForward: () => {
    const { stack, currentIndex } = get();
    if (currentIndex >= stack.length - 1) return null;
    const newIndex = currentIndex + 1;
    set({ currentIndex: newIndex });
    return stack[newIndex];
  },

  canGoBack: () => get().currentIndex > 0,
  canGoForward: () => get().currentIndex < get().stack.length - 1,
}));
