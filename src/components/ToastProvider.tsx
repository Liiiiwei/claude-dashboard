"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

// Toast 類型對應不同色系（沿用 liquid glass 配色）
type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ConfirmState {
  message: string;
  resolve: (ok: boolean) => void;
}

interface ToastApi {
  // 顯示短暫提示，預設 3.2 秒後自動消失
  toast: (message: string, kind?: ToastKind) => void;
  // 顯示確認對話框，回傳使用者是否按下確定
  confirm: (message: string) => Promise<boolean>;
}

const ToastContext = createContext<ToastApi | null>(null);

// 取得 toast / confirm API；必須包在 ToastProvider 內使用
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast 必須在 ToastProvider 內使用");
  }
  return ctx;
}

const KIND_CLASS: Record<ToastKind, string> = {
  success: "glass-green",
  error: "glass-amber",
  info: "glass-blue",
};

const KIND_ICON: Record<ToastKind, string> = {
  success: "✓",
  error: "!",
  info: "i",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const idRef = useRef(0);

  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ message, resolve });
    });
  }, []);

  const closeConfirm = useCallback(
    (ok: boolean) => {
      if (confirmState) confirmState.resolve(ok);
      setConfirmState(null);
    },
    [confirmState],
  );

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast 堆疊：右上角 */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${KIND_CLASS[t.kind]} toast-enter pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg max-w-xs`}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/40 text-xs font-bold">
              {KIND_ICON[t.kind]}
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Confirm 對話框 */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/20 p-4"
          onClick={() => closeConfirm(false)}
        >
          <div
            className="glass-card toast-enter w-full max-w-sm rounded-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-5 text-sm leading-relaxed text-gray-800">
              {confirmState.message}
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="glass-button rounded-lg px-4 py-2 text-sm"
                onClick={() => closeConfirm(false)}
              >
                取消
              </button>
              <button
                className="glass-amber rounded-lg px-4 py-2 text-sm font-medium"
                onClick={() => closeConfirm(true)}
                autoFocus
              >
                確定
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
