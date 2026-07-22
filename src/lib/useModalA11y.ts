"use client";

import { useEffect, useRef } from "react";

// 對話框無障礙：Esc 關閉、focus trap、關閉後把焦點歸還觸發元素。
// 回傳一個 ref，掛到對話框容器上即可。
export function useModalA11y(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // 記住開啟前的焦點元素，關閉時歸還
    restoreRef.current = document.activeElement as HTMLElement | null;

    // 開啟後把焦點移進對話框（優先第一個可聚焦元素）
    const focusFirst = () => {
      if (!ref.current) return;
      const items = ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (items[0] ?? ref.current).focus();
    };
    // 等下一個 frame，確保 autoFocus 元素先就位再決定
    const raf = requestAnimationFrame(() => {
      if (ref.current && !ref.current.contains(document.activeElement)) {
        focusFirst();
      }
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      const items = ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      // 歸還焦點給觸發者
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  return ref;
}
