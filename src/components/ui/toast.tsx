"use client";

import { X, AlertCircle, CheckCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/lib/toast-store";
import type { Toast } from "@/lib/toast-store";

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertCircle,
  info: Info,
} as const;

const colors = {
  success: "bg-green-500/90 text-white",
  error: "bg-red-500/90 text-white",
  warning: "bg-amber-500/90 text-white",
  info: "bg-blue-500/90 text-white",
} as const;

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const Icon = icons[toast.type];

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm animate-in slide-in-from-right duration-300",
        colors[toast.type]
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <p className="text-sm flex-1">{toast.message}</p>
      <button
        onClick={onRemove}
        className="shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

// 便捷 hooks
export function useToast() {
  const showToast = useToastStore((s) => s.showToast);
  return { showToast };
}
