"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { usePolling } from "@/lib/usePolling";
import { useToast } from "./ToastProvider";

interface PortInfo {
  pid: number;
  port: number;
  projectName: string | null;
  projectPath: string | null;
  cpu: number;
  mem: number;
  assigned: boolean;
}

interface PortsResponse {
  ports: PortInfo[];
  registry: Record<string, number>;
}

type LoadStatus = "loading" | "error" | "ready";

// 把路徑縮短成「.../父資料夾/專案名」
function shortPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 3) return path;
  return ".../" + parts.slice(-3).join("/");
}

export default function PortManager() {
  const { toast, confirm } = useToast();
  const [data, setData] = useState<PortsResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [killing, setKilling] = useState<number | null>(null);
  const [killingAll, setKillingAll] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const hasLoadedRef = useRef(false);

  const fetchPorts = useCallback(async () => {
    try {
      const res = await fetch("/api/ports");
      if (!res.ok) throw new Error("讀取失敗");
      const json: PortsResponse = await res.json();
      setData(json);
      setStatus("ready");
      hasLoadedRef.current = true;
    } catch {
      // 已載入過就沿用舊資料、不打斷；首次載入失敗才進入錯誤態
      if (!hasLoadedRef.current) setStatus("error");
    }
  }, []);

  // 每 10 秒輪詢，分頁不可見時暫停
  usePolling(fetchPorts, 10000);

  const handleKill = async (pid: number, projectName?: string | null) => {
    const ok = await confirm(
      `確定要終止 ${projectName || "未知專案"}（PID ${pid}）？`,
    );
    if (!ok) return;
    setKilling(pid);
    try {
      const res = await fetch("/api/ports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "kill", pid }),
      });
      if (res.ok) await fetchPorts();
      else toast("終止失敗", "error");
    } catch {
      toast("終止失敗", "error");
    } finally {
      setKilling(null);
    }
  };

  const handleKillAll = async () => {
    const ok = await confirm(
      `確定要終止全部 ${runningCount} 個執行中的 port？`,
    );
    if (!ok) return;
    setKillingAll(true);
    try {
      const res = await fetch("/api/ports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "killAll" }),
      });
      if (res.ok) await fetchPorts();
      else toast("終止失敗", "error");
    } catch {
      toast("終止失敗", "error");
    } finally {
      setKillingAll(false);
    }
  };

  const runningPorts = useMemo(() => data?.ports ?? [], [data]);
  const runningCount = runningPorts.length;

  // 重複 process：同一 projectPath 多個，保留 port 最小的，其餘視為可清理
  const duplicatePids = useMemo(() => {
    const byPath = new Map<string, PortInfo[]>();
    for (const p of runningPorts) {
      if (!p.projectPath) continue;
      const list = byPath.get(p.projectPath) || [];
      list.push(p);
      byPath.set(p.projectPath, list);
    }
    const pids: number[] = [];
    for (const [, list] of byPath) {
      if (list.length <= 1) continue;
      list.sort((a, b) => a.port - b.port);
      for (let i = 1; i < list.length; i++) pids.push(list[i].pid);
    }
    return pids;
  }, [runningPorts]);

  // 手動清理重複 process（改自舊版的自動清理，避免無預警終止使用者的 server）
  const handleCleanDuplicates = async () => {
    const ok = await confirm(
      `偵測到 ${duplicatePids.length} 個重複的 process，確定要終止它們？（每個專案保留 port 最小的那一個）`,
    );
    if (!ok) return;
    setCleaning(true);
    let failed = 0;
    try {
      for (const pid of duplicatePids) {
        try {
          const res = await fetch("/api/ports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "kill", pid }),
          });
          if (!res.ok) failed++;
        } catch {
          failed++;
        }
      }
      await fetchPorts();
      if (failed > 0) toast(`清理完成，${failed} 個失敗`, "error");
      else toast("已清理重複 process", "success");
    } finally {
      setCleaning(false);
    }
  };

  const runningPaths = new Set(
    runningPorts.map((p) => p.projectPath).filter(Boolean),
  );
  const inactivePorts = data
    ? Object.entries(data.registry)
        .filter(([path]) => !runningPaths.has(path))
        .map(([path, port]) => ({ path, port }))
    : [];

  // 首次載入中：顯示載入態，避免無回饋
  if (status === "loading") {
    return (
      <div className="glass rounded-xl px-4 py-3 mb-4 text-xs text-gray-500">
        <span className="spin inline-block mr-1.5" aria-hidden>
          ↻
        </span>
        載入 port 狀態中…
      </div>
    );
  }

  // 首次載入失敗：顯示錯誤態與重試
  if (status === "error") {
    return (
      <div className="glass rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3 text-xs">
        <span className="text-red-600">無法讀取 port 狀態</span>
        <button
          onClick={fetchPorts}
          className="glass-button rounded-lg px-2.5 py-1 text-red-700"
        >
          重試
        </button>
      </div>
    );
  }

  // 空狀態：沒有任何 port 資料時不顯示，避免空卡片佔位
  if (runningCount === 0 && inactivePorts.length === 0) return null;

  return (
    <div className="glass rounded-xl px-4 py-3 mb-4">
      {/* 標題列 */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-semibold text-gray-700">
          Ports · {runningCount} running
        </span>
        <div className="flex items-center gap-1.5">
          {duplicatePids.length > 0 && (
            <button
              onClick={handleCleanDuplicates}
              disabled={cleaning || killingAll || killing !== null}
              className="glass-button px-2.5 py-1 rounded-lg text-[11px] font-medium text-gray-600 disabled:opacity-50"
              title="終止每個專案多餘的重複 process"
            >
              {cleaning ? "清理中..." : `清理重複 (${duplicatePids.length})`}
            </button>
          )}
          {runningCount > 0 && (
            <button
              onClick={handleKillAll}
              disabled={killingAll || killing !== null || cleaning}
              className="glass-amber px-2.5 py-1 rounded-lg text-[11px] font-medium disabled:opacity-50"
            >
              {killingAll ? "終止中..." : "全部終止"}
            </button>
          )}
        </div>
      </div>

      {/* 執行中的 port 列表 */}
      {runningCount > 0 && (
        <div className="space-y-1.5">
          {runningPorts.map((p) => (
            <div
              key={p.pid}
              className="flex items-center gap-3 bg-white/40 border border-white/50 rounded-lg px-3 py-2 text-xs hover:bg-white/55 transition-colors"
            >
              <a
                href={`http://localhost:${p.port}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono font-semibold text-blue-600 hover:text-blue-800 hover:underline w-14 shrink-0"
                title={`開啟 http://localhost:${p.port}`}
              >
                :{p.port}
              </a>
              <div className="flex-1 min-w-0">
                <div className="text-gray-800 font-medium truncate">
                  {p.projectName || "未知"}
                </div>
                {p.projectPath && (
                  <div
                    className="text-[10px] text-gray-500 font-mono truncate"
                    title={p.projectPath}
                  >
                    {shortPath(p.projectPath)}
                  </div>
                )}
              </div>
              <span
                className="text-gray-500 shrink-0 tabular-nums"
                title={`CPU ${p.cpu.toFixed(1)}% · RAM ${p.mem.toFixed(1)}%`}
              >
                {p.cpu.toFixed(1)}%
              </span>
              <span className="text-gray-500 shrink-0 text-[10px] font-mono">
                PID {p.pid}
              </span>
              <button
                onClick={() => handleKill(p.pid, p.projectName)}
                disabled={killing === p.pid || killingAll || cleaning}
                aria-label={`終止 ${p.projectName || "未知專案"}（PID ${p.pid}）`}
                className="text-red-500 hover:text-red-700 disabled:opacity-50 shrink-0 font-medium w-5 h-5 flex items-center justify-center rounded hover:bg-red-50/60 transition-colors"
                title={`終止 PID ${p.pid}`}
              >
                <span aria-hidden>{killing === p.pid ? "..." : "✕"}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 已分配但未啟動 */}
      {inactivePorts.length > 0 && (
        <>
          <div className="border-t border-white/30 mt-2.5 pt-2 mb-1.5">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
              已分配 · 未啟動
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {inactivePorts.map(({ path, port }) => (
              <div
                key={path}
                className="flex items-center gap-2 bg-white/20 border border-white/30 rounded-lg px-2.5 py-1.5 text-xs"
              >
                <span className="font-mono text-gray-500 shrink-0">
                  :{port}
                </span>
                <span className="text-gray-500 truncate flex-1" title={path}>
                  {path.split("/").pop() || path}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
