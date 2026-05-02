"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// API 回傳的 port 資訊
interface PortInfo {
  pid: number;
  port: number;
  projectName: string | null;
  projectPath: string | null;
  cpu: number;
  mem: number;
  assigned: boolean;
}

// API 回傳格式
interface PortsResponse {
  ports: PortInfo[];
  registry: Record<string, number>;
}

export default function PortManager() {
  const [data, setData] = useState<PortsResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [killing, setKilling] = useState<number | null>(null);
  const [killingAll, setKillingAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dedupInProgress = useRef(false);

  // 取得 port 資料
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

  // 初始載入與輪詢（每 10 秒）
  useEffect(() => {
    fetchPorts();
    const interval = setInterval(fetchPorts, 10000);
    return () => clearInterval(interval);
  }, [fetchPorts]);

  // 點擊面板外關閉 dropdown
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // 終止單一 process
  const handleKill = async (pid: number) => {
    setKilling(pid);
    try {
      const res = await fetch("/api/ports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "kill", pid }),
      });
      if (res.ok) {
        await fetchPorts();
      }
    } catch {
      // 靜默處理
    } finally {
      setKilling(null);
    }
  };

  // 終止全部 process
  const handleKillAll = async () => {
    setKillingAll(true);
    try {
      const res = await fetch("/api/ports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "killAll" }),
      });
      if (res.ok) {
        await fetchPorts();
      }
    } catch {
      // 靜默處理
    } finally {
      setKillingAll(false);
    }
  };

  // 自動清理重複 process（同一 projectPath 有多個 process，保留 port 最小的）
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
      for (let i = 1; i < list.length; i++) {
        toKill.push(list[i].pid);
      }
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

  // 找出已分配但未啟動的 port
  const runningPaths = new Set(
    runningPorts.map((p) => p.projectPath).filter(Boolean),
  );
  const inactivePorts = data
    ? Object.entries(data.registry)
        .filter(([path]) => !runningPaths.has(path))
        .map(([path, port]) => ({ path, port }))
    : [];

  return (
    <div className="relative ml-auto" ref={panelRef}>
      {/* 收合狀態 */}
      <div className="flex items-center gap-2">
        <span className="text-gray-600">Ports: {runningCount} running</span>
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="glass-button px-2.5 py-1 rounded-lg text-xs font-medium text-gray-700 hover:text-gray-900"
        >
          {open ? "關閉" : "管理"}
        </button>
      </div>

      {/* 展開狀態：dropdown 面板 */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 glass rounded-xl shadow-lg z-50 p-3">
          {/* 標題列 */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-800">
              執行中的 Port
            </span>
            {runningCount > 0 && (
              <button
                onClick={handleKillAll}
                disabled={killingAll || killing !== null}
                className="glass-amber px-2.5 py-1 rounded-lg text-xs font-medium disabled:opacity-50"
              >
                {killingAll ? "終止中..." : "全部終止"}
              </button>
            )}
          </div>

          {/* 執行中的 port 列表 */}
          {runningCount === 0 ? (
            <div className="text-xs text-gray-400 py-3 text-center">
              目前沒有執行中的 port
            </div>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {runningPorts.map((p) => (
                <div
                  key={p.pid}
                  className="flex items-center gap-2 bg-white/40 border border-white/50 rounded-lg px-2.5 py-1.5 text-xs"
                >
                  <a
                    href={`http://localhost:${p.port}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono font-semibold text-blue-600 hover:text-blue-800 hover:underline w-12 shrink-0"
                    title={`開啟 http://localhost:${p.port}`}
                  >
                    :{p.port}
                  </a>
                  <span
                    className="text-gray-600 truncate flex-1"
                    title={p.projectPath ?? undefined}
                  >
                    {p.projectName || "未知"}
                  </span>
                  <span className="text-gray-400 shrink-0">
                    {p.cpu.toFixed(1)}%
                  </span>
                  <button
                    onClick={() => handleKill(p.pid)}
                    disabled={killing === p.pid || killingAll}
                    className="text-red-500 hover:text-red-700 disabled:opacity-50 shrink-0 font-medium"
                    title={`終止 PID ${p.pid}`}
                  >
                    {killing === p.pid ? "..." : "x"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 已分配但未啟動的 port */}
          {inactivePorts.length > 0 && (
            <>
              <div className="border-t border-white/30 mt-2 pt-2">
                <span className="text-xs text-gray-400">已分配 (未啟動)</span>
              </div>
              <div className="space-y-1 mt-1">
                {inactivePorts.map(({ path, port }) => (
                  <div
                    key={path}
                    className="flex items-center gap-2 bg-white/20 border border-white/30 rounded-lg px-2.5 py-1.5 text-xs opacity-50"
                  >
                    <span className="font-mono text-gray-500 w-12 shrink-0">
                      :{port}
                    </span>
                    <span
                      className="text-gray-400 truncate flex-1"
                      title={path}
                    >
                      {path.split("/").pop() || path}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
