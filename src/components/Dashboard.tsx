"use client";

import { useState, useCallback, useMemo } from "react";
import type { ProjectStatus } from "@/lib/types";
import ProjectCard from "./ProjectCard";
import FilterBar from "./FilterBar";
import SkeletonCard from "./SkeletonCard";
import KanbanBoard from "./KanbanBoard";
import PinnedBar from "./PinnedBar";
import PortManager from "./PortManager";
import SystemStatsBar from "./SystemStatsBar";
import CommitDialog from "./CommitDialog";
import DailyTasks from "./DailyTasks";
import { useToast } from "./ToastProvider";
import { useLocalStorageState } from "@/lib/useLocalStorageState";
import { useProjects } from "@/lib/useProjects";
import { useRunningPorts } from "@/lib/useRunningPorts";

export default function Dashboard() {
  const { toast } = useToast();
  // 專案清單：取數 + 防競態邏輯抽到 useProjects
  const {
    projects,
    setProjects,
    loading,
    error,
    degraded,
    refetch: fetchProjects,
  } = useProjects();
  // 執行中 port 的單一真實來源：Dashboard 卡片與 PortManager 都消費它
  const {
    data: portsData,
    status: portsStatus,
    refetch: refetchPorts,
    runningPortsByPath,
    registerStarted,
  } = useRunningPorts();

  const [showCommitDialog, setShowCommitDialog] = useState(false);

  // 使用者偏好：以 localStorage 同步，避免 hydration mismatch（見 hook 實作）
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

  // 回傳是否成功，讓卡片能顯示 pending / 失敗回饋
  const handleStatusChange = useCallback(
    async (name: string, status: ProjectStatus): Promise<boolean> => {
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
        return true;
      } catch {
        toast("狀態更新失敗", "error");
        return false;
      }
    },
    [toast, setProjects],
  );

  const handleDevServerStarted = useCallback(
    (projectPath: string, port: number) => {
      // 樂觀登記到單一真實來源，並立即補抓 /api/ports
      registerStarted(projectPath, port);
    },
    [registerStarted],
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
    [toast, setProjects],
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
    [toast, setProjects],
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

      {/* Port 管理（消費單一真實來源，與卡片同步） */}
      <PortManager
        data={portsData}
        status={portsStatus}
        onRefetch={refetchPorts}
      />

      {/* 釘選列 */}
      {pinnedProjects.length > 0 && (
        <PinnedBar
          projects={pinnedProjects}
          onUnpin={handleUnpin}
          onReorder={handleReorderPinned}
        />
      )}

      {/* 日常任務面板：直接顯示於看板上方，跨客戶待辦一眼可見 */}
      <DailyTasks />

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

      {/* 專案看板：與日常任務同時呈現，不再用分頁隱藏 */}
      <div>
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
        ) : error ? null : sorted // 錯誤時不顯示空狀態，橫幅已在上方呈現
          .length === 0 ? (
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
            runningPorts={runningPortsByPath}
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
                runningPort={runningPortsByPath[project.path] ?? null}
                degraded={degraded}
                loading={loading}
                onDevServerStarted={handleDevServerStarted}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>

      {/* 批次提交對話框 */}
      {showCommitDialog && (
        <CommitDialog
          dirtyCount={dirtyCount}
          onClose={() => setShowCommitDialog(false)}
          onCommitted={fetchProjects}
        />
      )}
    </main>
  );
}
