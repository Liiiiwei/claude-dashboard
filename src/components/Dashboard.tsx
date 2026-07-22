"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Project, ProjectStatus } from "@/lib/types";
import ProjectCard from "./ProjectCard";
import FilterBar from "./FilterBar";
import SkeletonCard from "./SkeletonCard";
import KanbanBoard from "./KanbanBoard";
import PinnedBar from "./PinnedBar";
import PortManager from "./PortManager";
import SystemStatsBar from "./SystemStatsBar";
import { useToast } from "./ToastProvider";
import { useLocalStorageState } from "@/lib/useLocalStorageState";
import { useModalA11y } from "@/lib/useModalA11y";

export default function Dashboard() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 後端偵測不可用時為 true：無法判定各專案 dev server 是否在跑
  const [degraded, setDegraded] = useState(false);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [commitMsg, setCommitMsg] = useState("");
  const [committing, setCommitting] = useState(false);

  // 使用者偏好：以 localStorage 同步，避免 hydration mismatch（見 hook 實作）
  const [tab, setTab] = useLocalStorageState<"projects" | "daily">(
    "dashboard-tab",
    "projects",
  );
  const [activeTag, setActiveTag] = useLocalStorageState(
    "dashboard-tag",
    "全部",
  );
  const [activeGroup, setActiveGroup] = useLocalStorageState(
    "dashboard-group",
    "全部",
  );
  const [sortBy, setSortBy] = useLocalStorageState<"lastModified" | "name">(
    "dashboard-sort",
    "lastModified",
  );
  const [view, setView] = useLocalStorageState<"list" | "kanban">(
    "dashboard-view",
    "kanban",
  );

  const [runningPorts, setRunningPorts] = useState<Record<string, number>>({});
  const hasLoadedRef = useRef(false);
  // 請求序號與 AbortController：避免競態與對已卸載元件 setState
  const reqIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const fetchProjects = useCallback(async () => {
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
      // 用後端即時偵測結果補上正在執行的 server，讓初次載入就能看到狀態
      setRunningPorts((prev) => {
        const next = { ...prev };
        for (const p of data) {
          if (p.runningPort != null) next[p.path] = p.runningPort;
          else if (next[p.path] != null) delete next[p.path];
        }
        return next;
      });
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
    fetchProjects();
    return () => {
      // 卸載時中止仍在飛的請求
      abortRef.current?.abort();
    };
  }, [fetchProjects]);

  const dirtyCount = useMemo(
    () => projects.filter((p) => p.git && p.git.dirty > 0).length,
    [projects],
  );

  // 狀態計數：一次遍歷取代四次 filter().length
  const statusCounts = useMemo(() => {
    const c = { 進行中: 0, 待辦: 0, 已完成: 0, 暫停: 0 } as Record<
      ProjectStatus,
      number
    >;
    for (const p of projects) c[p.status]++;
    return c;
  }, [projects]);

  const handleBatchCommit = useCallback(async () => {
    // 重入保護：提交中或訊息為空直接返回
    if (committing || !commitMsg.trim()) return;
    setCommitting(true);
    try {
      const res = await fetch("/api/git-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: commitMsg.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "批次提交失敗");
      const failed =
        data.results?.filter((r: { success: boolean }) => !r.success) || [];
      if (failed.length > 0) {
        toast(
          `已提交 ${data.committed} 個專案，${failed.length} 個失敗`,
          "error",
        );
      } else {
        toast(`已提交 ${data.committed} 個專案`, "success");
      }
      setShowCommitDialog(false);
      setCommitMsg("");
      fetchProjects();
    } catch (err) {
      toast(err instanceof Error ? err.message : "批次提交失敗", "error");
    } finally {
      setCommitting(false);
    }
  }, [committing, commitMsg, toast, fetchProjects]);

  const closeCommitDialog = useCallback(() => {
    setShowCommitDialog(false);
    setCommitMsg("");
  }, []);

  // 批次提交對話框的 a11y（focus trap / Esc / 焦點還原）
  const commitDialogRef = useModalA11y(showCommitDialog, closeCommitDialog);

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
        toast("狀態更新失敗", "error");
      }
    },
    [toast],
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

  const handleUnpin = useCallback(
    async (name: string) => {
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
        toast("取消釘選失敗", "error");
      }
    },
    [toast],
  );

  // 拖移釘選列重新排序：optimistic 更新 + PATCH 寫回
  const handleReorderPinned = useCallback(
    async (orderedNames: string[]) => {
      const updates = orderedNames.map((name, idx) => ({
        name,
        pinOrder: idx,
      }));
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
        toast("儲存順序失敗", "error");
      }
    },
    [toast],
  );

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
                  {statusCounts["進行中"]} 進行中
                </span>
                <span className="text-gray-500">
                  {statusCounts["待辦"]} 待辦
                </span>
                <span className="text-green-600">
                  {statusCounts["已完成"]} 已完成
                </span>
                <span className="text-amber-600">
                  {statusCounts["暫停"]} 暫停
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
            className="px-5 py-2.5 glass-button rounded-xl text-sm font-medium text-gray-600 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <span className={loading ? "spin" : ""} aria-hidden>
              ↻
            </span>
            刷新
          </button>
        </div>
      </div>

      {/* 系統狀態列（自帶輪詢，與專案資料解耦） */}
      <SystemStatsBar />

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
      <div
        role="tablist"
        aria-label="儀表板分頁"
        className="flex gap-1 mb-6 border-b border-white/40"
      >
        <button
          role="tab"
          id="tab-projects"
          aria-selected={tab === "projects"}
          aria-controls="panel-projects"
          onClick={() => setTab("projects")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "projects"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          專案看板
        </button>
        <button
          role="tab"
          id="tab-daily"
          aria-selected={tab === "daily"}
          aria-controls="panel-daily"
          onClick={() => setTab("daily")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "daily"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          日常任務
        </button>
      </div>

      {/* 錯誤優先於空狀態：載入失敗時顯示可重試的錯誤橫幅 */}
      {error && (
        <div className="bg-red-100/60 border border-red-200/60 text-red-700 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={fetchProjects}
            disabled={loading}
            className="glass-button rounded-lg px-3 py-1.5 text-sm text-red-700 disabled:opacity-50 shrink-0"
          >
            重試
          </button>
        </div>
      )}

      {tab === "projects" && (
        <div role="tabpanel" id="panel-projects" aria-labelledby="tab-projects">
          {!loading && !error && projects.length > 0 && (
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

          {!loading && !error && allGroups.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs text-gray-500 py-2">分組：</span>
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

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : error ? // 錯誤時不顯示空狀態，橫幅已在上方呈現
          null : sorted.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
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
              degraded={degraded}
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
                  degraded={degraded}
                  onDevServerStarted={handleDevServerStarted}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 日常任務分頁：功能尚未開放，先顯示佔位狀態 */}
      {tab === "daily" && (
        <div
          role="tabpanel"
          id="panel-daily"
          aria-labelledby="tab-daily"
          className="glass-card flex flex-col items-center justify-center rounded-2xl py-20 text-center text-gray-500"
        >
          <div className="mb-3 text-4xl" aria-hidden>
            🗓️
          </div>
          <p className="text-lg font-medium text-gray-500">日常任務即將推出</p>
          <p className="mt-2 max-w-sm text-sm">
            這裡之後會放每日例行事項與待辦清單，目前還在施工中。
          </p>
        </div>
      )}

      {/* 批次提交對話框 */}
      {showCommitDialog && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={closeCommitDialog}
        >
          <div
            ref={commitDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="commit-dialog-title"
            className="glass rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="commit-dialog-title"
              className="text-lg font-bold text-gray-800 mb-1"
            >
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
              aria-label="commit 訊息"
              disabled={committing}
              className="w-full bg-white/40 text-gray-700 rounded-xl px-4 py-3 border border-white/50 focus:border-amber-400 focus:outline-none mb-4 placeholder:text-gray-500 disabled:opacity-60"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={closeCommitDialog}
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
