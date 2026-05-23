"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Project, ProjectStatus } from "@/lib/types";
import ProjectCard from "./ProjectCard";
import FilterBar from "./FilterBar";
import SkeletonCard from "./SkeletonCard";
import KanbanBoard from "./KanbanBoard";
import PinnedBar from "./PinnedBar";
import PortManager from "./PortManager";

interface SystemStats {
  cpu: number;
  mem: { total: number; used: number; percent: number };
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [commitMsg, setCommitMsg] = useState("");
  const [committing, setCommitting] = useState(false);
  const [tab, setTab] = useState<"projects" | "daily">("projects");
  const [activeTag, setActiveTag] = useState("全部");
  const [activeGroup, setActiveGroup] = useState("全部");
  const [sortBy, setSortBy] = useState<"lastModified" | "name">("lastModified");
  const [view, setView] = useState<"list" | "kanban">("kanban");

  // 從 localStorage 恢復偏好（hydration 後）
  useEffect(() => {
    const savedTab = localStorage.getItem("dashboard-tab") as
      | "projects"
      | "daily"
      | null;
    const savedTag = localStorage.getItem("dashboard-tag");
    const savedSort = localStorage.getItem("dashboard-sort") as
      | "lastModified"
      | "name"
      | null;
    const savedView = localStorage.getItem("dashboard-view") as
      | "list"
      | "kanban"
      | null;
    if (savedTab) setTab(savedTab);
    if (savedTag) setActiveTag(savedTag);
    if (savedSort) setSortBy(savedSort);
    if (savedView) setView(savedView);
  }, []);

  const [runningPorts, setRunningPorts] = useState<Record<string, number>>({});
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const hasLoadedRef = useRef(false);

  // 偏好變更時存入 localStorage
  useEffect(() => {
    localStorage.setItem("dashboard-tag", activeTag);
  }, [activeTag]);
  useEffect(() => {
    localStorage.setItem("dashboard-sort", sortBy);
  }, [sortBy]);
  useEffect(() => {
    localStorage.setItem("dashboard-view", view);
  }, [view]);
  useEffect(() => {
    localStorage.setItem("dashboard-tab", tab);
  }, [tab]);

  const fetchProjects = useCallback(async () => {
    try {
      setError(null);
      if (!hasLoadedRef.current) setLoading(true);
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("掃描失敗");
      const data: Project[] = await res.json();
      setProjects(data);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知錯誤");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSystemStats = useCallback(async () => {
    try {
      const res = await fetch("/api/system-stats");
      if (res.ok) setSystemStats(await res.json());
    } catch {
      /* 靜默 */
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchSystemStats();
    const statsInterval = setInterval(fetchSystemStats, 5000);
    return () => {
      clearInterval(statsInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirtyCount = useMemo(
    () => projects.filter((p) => p.git && p.git.dirty > 0).length,
    [projects],
  );

  const handleBatchCommit = async () => {
    if (!commitMsg.trim()) return;
    setCommitting(true);
    try {
      const res = await fetch("/api/git-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: commitMsg.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const failed =
        data.results?.filter((r: { success: boolean }) => !r.success) || [];
      if (failed.length > 0) {
        alert(`已提交 ${data.committed} 個專案，${failed.length} 個失敗`);
      }
      setShowCommitDialog(false);
      setCommitMsg("");
      fetchProjects();
    } catch {
      alert("批次提交失敗");
    } finally {
      setCommitting(false);
    }
  };

  const handleStatusChange = useCallback(
    async (name: string, status: ProjectStatus) => {
      try {
        const res = await fetch("/api/projects", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, status }),
        });
        if (!res.ok) throw new Error("更新失敗");
        setProjects((prev) =>
          prev.map((p) => (p.name === name ? { ...p, status } : p)),
        );
      } catch {
        alert("狀態更新失敗");
      }
    },
    [],
  );

  const handleDevServerStarted = useCallback(
    (projectPath: string, port: number) => {
      setRunningPorts((prev) => ({ ...prev, [projectPath]: port }));
    },
    [],
  );

  const allTags = useMemo(
    () =>
      Array.from(
        new Set(projects.flatMap((p) => p.tags.filter((t) => t !== "Git"))),
      ).sort(),
    [projects],
  );

  const allGroups = useMemo(
    () =>
      Array.from(
        new Set(projects.map((p) => p.group).filter(Boolean)),
      ).sort() as string[],
    [projects],
  );

  const pinnedProjects = useMemo(
    () =>
      projects
        .filter((p) => p.pinned)
        .sort((a, b) => {
          if (a.pinOrder !== b.pinOrder) return a.pinOrder - b.pinOrder;
          return a.name.localeCompare(b.name);
        }),
    [projects],
  );

  const handleUnpin = useCallback(async (name: string) => {
    try {
      await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, field: "pinned", value: false }),
      });
      setProjects((prev) =>
        prev.map((p) => (p.name === name ? { ...p, pinned: false } : p)),
      );
    } catch {
      alert("取消釘選失敗");
    }
  }, []);

  // 拖移釘選列重新排序：optimistic 更新 + PATCH 寫回
  const handleReorderPinned = useCallback(async (orderedNames: string[]) => {
    const updates = orderedNames.map((name, idx) => ({ name, pinOrder: idx }));
    setProjects((prev) =>
      prev.map((p) => {
        const idx = orderedNames.indexOf(p.name);
        return idx >= 0 ? { ...p, pinOrder: idx } : p;
      }),
    );
    try {
      await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "_batch",
          field: "pinOrder",
          value: updates,
        }),
      });
    } catch {
      alert("儲存順序失敗");
    }
  }, []);

  const filtered = useMemo(
    () =>
      projects.filter((p) => {
        if (activeTag !== "全部" && !p.tags.includes(activeTag)) return false;
        if (activeGroup !== "全部" && p.group !== activeGroup) return false;
        return true;
      }),
    [projects, activeTag, activeGroup],
  );

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        return (
          new Date(b.lastModified).getTime() -
          new Date(a.lastModified).getTime()
        );
      }),
    [filtered, sortBy],
  );

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* 標題列 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">專案儀表板</h1>
          <div className="flex items-center gap-3 mt-1 text-sm">
            <span className="text-gray-500">{projects.length} 個專案</span>
            {projects.length > 0 && (
              <>
                <span className="text-blue-600">
                  {projects.filter((p) => p.status === "進行中").length} 進行中
                </span>
                <span className="text-gray-400">
                  {projects.filter((p) => p.status === "待辦").length} 待辦
                </span>
                <span className="text-green-600">
                  {projects.filter((p) => p.status === "已完成").length} 已完成
                </span>
                <span className="text-amber-600">
                  {projects.filter((p) => p.status === "暫停").length} 暫停
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {dirtyCount > 0 && (
            <button
              onClick={() => setShowCommitDialog(true)}
              className="px-5 py-2.5 glass-amber rounded-xl text-sm font-medium"
            >
              提交全部 ({dirtyCount})
            </button>
          )}
          <button
            onClick={fetchProjects}
            disabled={loading}
            className="px-5 py-2.5 glass-button rounded-xl text-sm font-medium text-gray-600 disabled:opacity-50"
          >
            刷新
          </button>
        </div>
      </div>

      {/* 系統狀態 + Port 管理 */}
      {systemStats && (
        <div className="flex flex-wrap items-center gap-4 mb-4 px-4 py-2.5 glass rounded-xl text-xs relative">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">CPU</span>
            <div className="w-20 h-1.5 bg-white/40 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  systemStats.cpu > 80
                    ? "bg-red-500"
                    : systemStats.cpu > 50
                      ? "bg-amber-500"
                      : "bg-green-500"
                }`}
                style={{ width: `${systemStats.cpu}%` }}
              />
            </div>
            <span className="text-gray-500">{systemStats.cpu}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">RAM</span>
            <div className="w-20 h-1.5 bg-white/40 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  systemStats.mem.percent > 80
                    ? "bg-red-500"
                    : systemStats.mem.percent > 50
                      ? "bg-amber-500"
                      : "bg-green-500"
                }`}
                style={{ width: `${systemStats.mem.percent}%` }}
              />
            </div>
            <span className="text-gray-500">
              {systemStats.mem.used}/{systemStats.mem.total}GB
            </span>
          </div>
        </div>
      )}

      {/* Port 管理 */}
      <PortManager />

      {/* 釘選列 */}
      {pinnedProjects.length > 0 && (
        <PinnedBar
          projects={pinnedProjects}
          onUnpin={handleUnpin}
          onReorder={handleReorderPinned}
        />
      )}

      {/* 分頁切換 */}
      <div className="flex gap-1 mb-6 border-b border-white/40">
        <button
          onClick={() => setTab("projects")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "projects"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          專案看板
        </button>
        <button
          onClick={() => setTab("daily")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "daily"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          日常任務
        </button>
      </div>

      {error && (
        <div className="bg-red-100/60 border border-red-200/60 text-red-700 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm">
          {error}
        </div>
      )}

      {tab === "projects" && !loading && projects.length > 0 && (
        <FilterBar
          tags={allTags}
          activeTag={activeTag}
          onTagChange={setActiveTag}
          sortBy={sortBy}
          onSortChange={setSortBy}
          view={view}
          onViewChange={setView}
          onUpdate={fetchProjects}
        />
      )}

      {tab === "projects" && !loading && allGroups.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs text-gray-400 py-2">分組：</span>
          <button
            onClick={() => setActiveGroup("全部")}
            className={`px-3 py-1.5 text-xs rounded-full transition-all ${
              activeGroup === "全部"
                ? "glass-button-active text-gray-800 font-medium"
                : "glass-button text-gray-500"
            }`}
          >
            全部
          </button>
          {allGroups.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                activeGroup === g
                  ? "glass-button-active text-gray-800 font-medium"
                  : "glass-button text-gray-500"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {tab === "projects" &&
        (loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">沒有找到任何專案</p>
            <p className="text-sm mt-2">
              {activeTag !== "全部" || activeGroup !== "全部"
                ? "嘗試切換篩選條件"
                : "請確認掃描目錄是否正確"}
            </p>
          </div>
        ) : view === "kanban" ? (
          <KanbanBoard
            projects={sorted}
            onStatusChange={handleStatusChange}
            onUpdate={fetchProjects}
            allGroups={allGroups}
            runningPorts={runningPorts}
            onDevServerStarted={handleDevServerStarted}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {sorted.map((project) => (
              <ProjectCard
                key={project.path}
                project={project}
                onUpdate={fetchProjects}
                allGroups={allGroups}
                runningPort={runningPorts[project.path] ?? null}
                onDevServerStarted={handleDevServerStarted}
              />
            ))}
          </div>
        ))}

      {/* 批次提交對話框 */}
      {showCommitDialog && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowCommitDialog(false)}
        >
          <div
            className="glass rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-800 mb-1">
              批次 Git 提交
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              將對 {dirtyCount} 個有變更的專案執行 git add -A && git commit
            </p>
            <input
              type="text"
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBatchCommit()}
              placeholder="輸入 commit 訊息..."
              className="w-full bg-white/40 text-gray-700 rounded-xl px-4 py-3 border border-white/50 focus:border-amber-400 focus:outline-none mb-4 placeholder:text-gray-400"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowCommitDialog(false);
                  setCommitMsg("");
                }}
                className="px-4 py-2 text-sm glass-button rounded-xl text-gray-600"
              >
                取消
              </button>
              <button
                onClick={handleBatchCommit}
                disabled={committing || !commitMsg.trim()}
                className="px-4 py-2 text-sm glass-amber rounded-xl disabled:opacity-50"
              >
                {committing ? "提交中..." : "確認提交"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
