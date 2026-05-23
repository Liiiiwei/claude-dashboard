"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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

// 把路徑縮短成「.../父資料夾/專案名」
function shortPath(path: string): string {
  const home = "/Users/";
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 3) return path;
  return ".../" + parts.slice(-3).join("/");
  void home;
}

export default function PortManager() {
  const [data, setData] = useState<PortsResponse | null>(null);
  const [killing, setKilling] = useState<number | null>(null);
  const [killingAll, setKillingAll] = useState(false);
  const dedupInProgress = useRef(false);

  const fetchPorts = useCallback(async () => {
    try {
      const res = await fetch("/api/ports");
      if (res.ok) {
        const json: PortsResponse = await res.json();
        setData(json);
      }
    } catch {
      // 靜默處理
    }
  }, []);

  useEffect(() => {
    fetchPorts();
    const interval = setInterval(fetchPorts, 10000);
    return () => clearInterval(interval);
  }, [fetchPorts]);

  const handleKill = async (pid: number) => {
    setKilling(pid);
    try {
      const res = await fetch("/api/ports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "kill", pid }),
      });
      if (res.ok) await fetchPorts();
    } catch {
      // 靜默處理
    } finally {
      setKilling(null);
    }
  };

  const handleKillAll = async () => {
    setKillingAll(true);
    try {
      const res = await fetch("/api/ports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "killAll" }),
      });
      if (res.ok) await fetchPorts();
    } catch {
      // 靜默處理
    } finally {
      setKillingAll(false);
    }
  };

  // 自動清理重複 process（同一 projectPath 多個，保留 port 最小的）
  useEffect(() => {
    if (!data?.ports || data.ports.length === 0) return;
    if (dedupInProgress.current) return;

    const byPath = new Map<string, PortInfo[]>();
    for (const p of data.ports) {
      if (!p.projectPath) continue;
      const list = byPath.get(p.projectPath) || [];
      list.push(p);
      byPath.set(p.projectPath, list);
    }

    const toKill: number[] = [];
    for (const [, list] of byPath) {
      if (list.length <= 1) continue;
      list.sort((a, b) => a.port - b.port);
      for (let i = 1; i < list.length; i++) toKill.push(list[i].pid);
    }

    if (toKill.length === 0) return;

    dedupInProgress.current = true;
    (async () => {
      for (const pid of toKill) {
        try {
          await fetch("/api/ports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "kill", pid }),
          });
        } catch {
          // 靜默處理
        }
      }
      await fetchPorts();
      dedupInProgress.current = false;
    })();
  }, [data?.ports, fetchPorts]);

  const runningPorts = data?.ports ?? [];
  const runningCount = runningPorts.length;

  const runningPaths = new Set(
    runningPorts.map((p) => p.projectPath).filter(Boolean),
  );
  const inactivePorts = data
    ? Object.entries(data.registry)
        .filter(([path]) => !runningPaths.has(path))
        .map(([path, port]) => ({ path, port }))
    : [];

  // 沒有任何 port 資料時不顯示，避免空卡片佔位
  if (runningCount === 0 && inactivePorts.length === 0) return null;

  return (
    <div className="glass rounded-xl px-4 py-3 mb-4">
      {/* 標題列 */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-semibold text-gray-700">
          Ports · {runningCount} running
        </span>
        {runningCount > 0 && (
          <button
            onClick={handleKillAll}
            disabled={killingAll || killing !== null}
            className="glass-amber px-2.5 py-1 rounded-lg text-[11px] font-medium disabled:opacity-50"
          >
            {killingAll ? "終止中..." : "全部終止"}
          </button>
        )}
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
                    className="text-[10px] text-gray-400 font-mono truncate"
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
              <span className="text-gray-300 shrink-0 text-[10px] font-mono">
                PID {p.pid}
              </span>
              <button
                onClick={() => handleKill(p.pid)}
                disabled={killing === p.pid || killingAll}
                className="text-red-500 hover:text-red-700 disabled:opacity-50 shrink-0 font-medium w-5 h-5 flex items-center justify-center rounded hover:bg-red-50/60 transition-colors"
                title={`終止 PID ${p.pid}`}
              >
                {killing === p.pid ? "..." : "✕"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 已分配但未啟動 */}
      {inactivePorts.length > 0 && (
        <>
          <div className="border-t border-white/30 mt-2.5 pt-2 mb-1.5">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">
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
