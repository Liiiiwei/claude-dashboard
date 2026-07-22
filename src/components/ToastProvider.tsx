"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useModalA11y } from "@/lib/useModalA11y";

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
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, kind }]);
    const t = setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
      timersRef.current.delete(t);
    }, 3200);
    timersRef.current.add(t);
  }, []);

  // 卸載時清掉所有尚未觸發的 timer，避免對已卸載元件 setState
  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState((prev) => {
        // 前一個未關閉的 confirm 視為取消，避免 Promise 永久 pending
        prev?.resolve(false);
        return { message, resolve };
      });
    });
  }, []);

  const closeConfirm = useCallback((ok: boolean) => {
    setConfirmState((prev) => {
      prev?.resolve(ok);
      return null;
    });
  }, []);

  // context value 用 useMemo 穩定參考，避免每則 toast 讓所有消費者重繪
  const api = useMemo<ToastApi>(() => ({ toast, confirm }), [toast, confirm]);

  const cancelConfirm = useCallback(() => closeConfirm(false), [closeConfirm]);
  const dialogRef = useModalA11y(confirmState !== null, cancelConfirm);

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Toast 堆疊：右上角。分兩個 live region，錯誤用 assertive、其餘用 polite */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        <div role="status" aria-live="polite" aria-atomic="false">
          {toasts
            .filter((t) => t.kind !== "error")
            .map((t) => (
              <ToastPill key={t.id} item={t} />
            ))}
        </div>
        <div role="alert" aria-live="assertive" aria-atomic="false">
          {toasts
            .filter((t) => t.kind === "error")
            .map((t) => (
              <ToastPill key={t.id} item={t} />
            ))}
        </div>
      </div>

      {/* Confirm 對話框 */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/20 p-4"
          onClick={cancelConfirm}
        >
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-message"
            className="glass-card toast-enter w-full max-w-sm rounded-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              id="confirm-dialog-message"
              className="mb-5 text-sm leading-relaxed text-gray-800"
            >
              {confirmState.message}
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="glass-button rounded-lg px-4 py-2 text-sm text-gray-700"
                onClick={cancelConfirm}
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

// 單則 toast 泡泡（抽出以便兩個 live region 共用）
function ToastPill({ item }: { item: ToastItem }) {
  return (
    <div
      className={`${KIND_CLASS[item.kind]} toast-enter pointer-events-auto mb-2 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg max-w-xs`}
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/40 text-xs font-bold"
        aria-hidden
      >
        {KIND_ICON[item.kind]}
      </span>
      <span>{item.message}</span>
    </div>
  );
}
