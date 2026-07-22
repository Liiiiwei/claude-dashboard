"use client";

import { useEffect, useRef } from "react";

// 定時輪詢，分頁隱藏時自動暫停、回到前景時立即補跑一次。
// fn 可為每次 render 變動的 closure，內部以 ref 取最新版本，避免重設 interval。
export function usePolling(fn: () => void, intervalMs: number) {
  const fnRef = useRef(fn);
  // 每次 render 後同步最新 closure，避免在 render 期間寫入 ref
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      fnRef.current();
      timer = setInterval(() => fnRef.current(), intervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () =>
      document.visibilityState === "visible" ? start() : stop();

    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}
