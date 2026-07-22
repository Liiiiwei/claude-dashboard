"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Project } from "./types";

export interface UseProjectsResult {
  projects: Project[];
  // 供樂觀更新（狀態變更、釘選、排序）直接寫入本地狀態
  setProjects: Dispatch<SetStateAction<Project[]>>;
  loading: boolean;
  error: string | null;
  // 後端偵測不可用時為 true：無法判定各專案 dev server 是否在跑
  degraded: boolean;
  refetch: () => Promise<void>;
}

// 專案清單取數邏輯：含 reqId + AbortController 的防競態機制，
// 只有最新一次請求可寫入狀態，卸載時中止仍在飛的請求。
export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);

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
      if (!hasLoadedRef.current) setLoading(true);
      const res = await fetch("/api/projects", { signal: controller.signal });
      if (!res.ok) throw new Error("掃描失敗");
      const raw = await res.json();
      // 相容兩種回應格式：裸 Project[] 或 { projects, degraded }
      const data: Project[] = Array.isArray(raw) ? raw : (raw.projects ?? []);
      const isDegraded = !Array.isArray(raw) && raw.degraded === true;
      // 只有最新一次請求可以寫入狀態
      if (reqId !== reqIdRef.current) return;
      setProjects(data);
      setDegraded(isDegraded);
      hasLoadedRef.current = true;
    } catch (err) {
      // 主動中止不算錯誤
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (reqId !== reqIdRef.current) return;
      setError(err instanceof Error ? err.message : "未知錯誤");
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    return () => {
      // 卸載時中止仍在飛的請求
      abortRef.current?.abort();
    };
  }, [refetch]);

  return { projects, setProjects, loading, error, degraded, refetch };
}
