"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { usePolling } from "./usePolling";

// 單一 running port 記錄（來自 /api/ports 的即時偵測）
export interface PortInfo {
  pid: number;
  port: number;
  projectName: string | null;
  projectPath: string | null;
  cpu: number;
  mem: number;
  assigned: boolean;
}

// /api/ports 的回傳結構（維持既有 API 契約，勿更動欄位）
export interface PortsResponse {
  ports: PortInfo[];
  registry: Record<string, number>;
}

export type PortsLoadStatus = "loading" | "error" | "ready";

// 樂觀啟動的暫存項目：dev server 剛啟動、偵測輪詢還沒跟上時先顯示，
// expires 到期或後端偵測已涵蓋該路徑就淘汰，避免殘留造成「卡片顯示執行中但實際沒跑」。
interface OptimisticEntry {
  port: number;
  expires: number;
}

// 樂觀項目存活時間：需大於一次輪詢週期，讓正常情況下能被真實資料接手
const OPTIMISTIC_TTL_MS = 12_000;

export interface UseRunningPortsResult {
  // 原始 /api/ports 資料（PortManager 直接消費）
  data: PortsResponse | null;
  status: PortsLoadStatus;
  // 立即重新抓取（kill / 啟動後呼叫）
  refetch: () => Promise<void>;
  // 專案路徑 -> 執行中的 port（Dashboard 卡片消費的單一真實來源）
  runningPortsByPath: Record<string, number>;
  // 樂觀登記某專案剛啟動的 dev server（含即時 refetch）
  registerStarted: (projectPath: string, port: number) => void;
}

// 全 Dashboard 共用的「執行中 port」單一真實來源。
// 只在 Dashboard 呼叫一次，透過 props 下傳給 PortManager 與各專案卡片，
// 兩邊消費同一份輪詢資料、同一頻率，避免狀態互相矛盾。
export function useRunningPorts(intervalMs = 10_000): UseRunningPortsResult {
  const [data, setData] = useState<PortsResponse | null>(null);
  const [status, setStatus] = useState<PortsLoadStatus>("loading");
  const [optimistic, setOptimistic] = useState<Record<string, OptimisticEntry>>(
    {},
  );
  const hasLoadedRef = useRef(false);

  const fetchPorts = useCallback(async () => {
    try {
      const res = await fetch("/api/ports");
      if (!res.ok) throw new Error("讀取失敗");
      const json: PortsResponse = await res.json();
      setData(json);
      setStatus("ready");
      hasLoadedRef.current = true;
      // 修剪樂觀項目：後端已偵測到（真實資料接手）或已過期者一律淘汰
      setOptimistic((prev) => {
        const keys = Object.keys(prev);
        if (keys.length === 0) return prev;
        const now = Date.now();
        const detected = new Set(
          json.ports.map((p) => p.projectPath).filter(Boolean) as string[],
        );
        let changed = false;
        const next: Record<string, OptimisticEntry> = {};
        for (const path of keys) {
          const entry = prev[path];
          if (detected.has(path) || entry.expires <= now) {
            changed = true;
            continue;
          }
          next[path] = entry;
        }
        return changed ? next : prev;
      });
    } catch {
      // 已載入過就沿用舊資料、不打斷；首次載入失敗才進入錯誤態
      if (!hasLoadedRef.current) setStatus("error");
    }
  }, []);

  // 每 intervalMs 輪詢，分頁不可見時暫停（沿用既有 usePolling）
  usePolling(fetchPorts, intervalMs);

  const registerStarted = useCallback(
    (projectPath: string, port: number) => {
      setOptimistic((prev) => ({
        ...prev,
        [projectPath]: { port, expires: Date.now() + OPTIMISTIC_TTL_MS },
      }));
      // 立即補抓一次，讓真實資料儘快接手樂觀值
      void fetchPorts();
    },
    [fetchPorts],
  );

  // 專案路徑 -> port：以 /api/ports 即時偵測為權威來源；
  // 同一路徑有多個 process 時取 port 最小者（與 PortManager 清理重複的規則一致）。
  // 樂觀項目只補在「真實資料尚無、且未過期」的路徑上。
  const runningPortsByPath = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of data?.ports ?? []) {
      if (!p.projectPath) continue;
      const cur = map[p.projectPath];
      if (cur == null || p.port < cur) map[p.projectPath] = p.port;
    }
    const now = Date.now();
    for (const [path, entry] of Object.entries(optimistic)) {
      if (map[path] == null && entry.expires > now) map[path] = entry.port;
    }
    return map;
  }, [data, optimistic]);

  return {
    data,
    status,
    refetch: fetchPorts,
    runningPortsByPath,
    registerStarted,
  };
}
