"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DailyTasksResponse } from "./types";

// 四狀態機：loading（載入中）/ error（取數失敗）/ empty（四組皆空）/ success（有資料）
export type DailyTasksStatus = "loading" | "error" | "empty" | "success";

export interface UseDailyTasksResult {
  data: DailyTasksResponse | null;
  status: DailyTasksStatus;
  error: string | null;
  refetch: () => Promise<void>;
}

// 判斷是否四組皆空
function isEmpty(data: DailyTasksResponse): boolean {
  const c = data.counts;
  return (
    c["ai-auto"] === 0 &&
    c["ai-draft"] === 0 &&
    c.human === 0 &&
    c.uncategorized === 0
  );
}

// 日常任務取數 hook：打 /api/daily-tasks，含 reqId + AbortController 防競態，
// 只有最新一次請求可寫入狀態，卸載時中止仍在飛的請求。仿 useProjects 寫法。
export function useDailyTasks(): UseDailyTasksResult {
  const [data, setData] = useState<DailyTasksResponse | null>(null);
  const [status, setStatus] = useState<DailyTasksStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);
  const reqIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    // 中止前一個仍在飛的請求
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setError(null);
      // 首次載入才顯示 loading；後續更新沿用既有資料，避免畫面閃爍
      if (!hasLoadedRef.current) setStatus("loading");
      const res = await fetch("/api/daily-tasks", {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("載入日常任務失敗");
      const json = (await res.json()) as DailyTasksResponse;
      // 只有最新一次請求可以寫入狀態
      if (reqId !== reqIdRef.current) return;
      setData(json);
      setStatus(isEmpty(json) ? "empty" : "success");
      hasLoadedRef.current = true;
    } catch (err) {
      // 主動中止不算錯誤
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (reqId !== reqIdRef.current) return;
      setError(err instanceof Error ? err.message : "未知錯誤");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    refetch();
    return () => {
      // 卸載時中止仍在飛的請求
      abortRef.current?.abort();
    };
  }, [refetch]);

  return { data, status, error, refetch };
}
