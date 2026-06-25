"use client";
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const toast = React.useMemo(() => ({
    success: (msg: string) => addToast(msg, "success"),
    error: (msg: string) => addToast(msg, "error"),
    info: (msg: string) => addToast(msg, "info"),
  }), [addToast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted && toasts.length > 0 && createPortal(
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-start justify-between gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 animate-fade-in-up ${
                t.type === "success"
                  ? "border-brand-teal/30 bg-[#06100c]/90 text-brand-teal"
                  : t.type === "error"
                  ? "border-red-500/25 bg-[#170505]/90 text-red-400"
                  : "border-brand-gold/25 bg-[#14120f]/90 text-brand-gold"
              }`}
            >
              <div className="flex gap-2.5 items-start">
                {t.type === "success" && <CheckCircle className="h-5 w-5 shrink-0" />}
                {t.type === "error" && <AlertCircle className="h-5 w-5 shrink-0" />}
                {t.type === "info" && <Info className="h-5 w-5 shrink-0" />}
                <p className="text-xs font-semibold leading-relaxed">{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))}
                className="text-white/40 hover:text-white transition-colors"
                aria-label="Close notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx.toast;
}
