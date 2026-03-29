"use client";

import { useState, useEffect, useCallback } from "react";
import type { Project, ProjectStatus } from "@/lib/types";
import ProjectCard from "./ProjectCard";
import FilterBar from "./FilterBar";
import SkeletonCard from "./SkeletonCard";
import KanbanBoard from "./KanbanBoard";
import DailyBoard from "./DailyBoard";

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [commitMsg, setCommitMsg] = useState("");
  const [committing, setCommitting] = useState(false);
  const [tab, setTab] = useState<"projects" | "daily">(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("dashboard-tab") as "projects" | "daily") || "projects";
    return "projects";
  });
  const [activeTag, setActiveTag] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("dashboard-tag") || "全部";
    return "全部";
  });
  const [activeGroup, setActiveGroup] = useState("全部");
  const [sortBy, setSortBy] = useState<"lastModified" | "name">(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("dashboard-sort") as "lastModified" | "name") || "lastModified";
    return "lastModified";
  });
  const [view, setView] = useState<"list" | "kanban">(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("dashboard-view") as "list" | "kanban") || "kanban";
    return "kanban";
  });

  // 偏好變更時存入 localStorage
  useEffect(() => { localStorage.setItem("dashboard-tag", activeTag); }, [activeTag]);
  useEffect(() => { localStorage.setItem("dashboard-sort", sortBy); }, [sortBy]);
  useEffect(() => { localStorage.setItem("dashboard-view", view); }, [view]);
  useEffect(() => { localStorage.setItem("dashboard-tab", tab); }, [tab]);

  const fetchProjects = useCallback(async () => {
    try {
      setError(null);
      if (projects.length === 0) setLoading(true);

      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("掃描失敗");

      const data: Project[] = await res.json();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知錯誤");
    } finally {
      setLoading(false);
    }
  }, [projects.length]);

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirtyCount = projects.filter((p) => p.git && p.git.dirty > 0).length;

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
      const failed = data.results?.filter((r: { success: boolean }) => !r.success) || [];
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

  const handleStatusChange = async (name: string, status: ProjectStatus) => {
    try {
      const res = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, status }),
      });
      if (!res.ok) throw new Error("更新失敗");
      // 更新本地狀態
      setProjects((prev) =>
        prev.map((p) => (p.name === name ? { ...p, status } : p))
      );
    } catch {
      alert("狀態更新失敗");
    }
  };

  // 從所有專案中收集標籤（排除 Git）
  const allTags = Array.from(
    new Set(projects.flatMap((p) => p.tags.filter((t) => t !== "Git")))
  ).sort();

  // 收集所有分組
  const allGroups = Array.from(
    new Set(projects.map((p) => p.group).filter(Boolean))
  ).sort();

  // 依標籤和分組篩選
  const filtered = projects.filter((p) => {
    if (activeTag !== "全部" && !p.tags.includes(activeTag)) return false;
    if (activeGroup !== "全部" && p.group !== activeGroup) return false;
    return true;
  });

  // 排序
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
  });

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">專案儀表板</h1>
          <div className="flex items-center gap-3 mt-1 text-sm">
            <span className="text-gray-400">{projects.length} 個專案</span>
            {projects.length > 0 && (
              <>
                <span className="text-blue-400">{projects.filter(p => p.status === "進行中").length} 進行中</span>
                <span className="text-gray-500">{projects.filter(p => p.status === "待辦").length} 待辦</span>
                <span className="text-green-400">{projects.filter(p => p.status === "已完成").length} 已完成</span>
                <span className="text-yellow-400">{projects.filter(p => p.status === "暫停").length} 暫停</span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {dirtyCount > 0 && (
            <button
              onClick={() => setShowCommitDialog(true)}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-medium transition-colors text-white"
            >
              提交全部 ({dirtyCount})
            </button>
          )}
          <button
            onClick={fetchProjects}
            disabled={loading}
            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            刷新
          </button>
        </div>
      </div>

      {/* 分頁切換 */}
      <div className="flex gap-1 mb-6 border-b border-gray-800">
        <button
          onClick={() => setTab("projects")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "projects" ? "border-blue-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          專案看板
        </button>
        <button
          onClick={() => setTab("daily")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "daily" ? "border-blue-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          日常任務
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {tab === "daily" && <DailyBoard />}

      {tab === "projects" && !loading && projects.length > 0 && (
        <FilterBar
          tags={allTags}
          activeTag={activeTag}
          onTagChange={setActiveTag}
          sortBy={sortBy}
          onSortChange={setSortBy}
          view={view}
          onViewChange={setView}
        />
      )}

      {tab === "projects" && !loading && allGroups.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs text-gray-500 py-2">分組：</span>
          <button
            onClick={() => setActiveGroup("全部")}
            className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
              activeGroup === "全部" ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            全部
          </button>
          {allGroups.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                activeGroup === g ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {tab === "projects" && (
        loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg">沒有找到任何專案</p>
            <p className="text-sm mt-2">
              {activeTag !== "全部" || activeGroup !== "全部"
                ? "嘗試切換篩選條件"
                : "請確認掃描目錄是否正確"}
            </p>
          </div>
        ) : view === "kanban" ? (
          <KanbanBoard projects={sorted} onStatusChange={handleStatusChange} onUpdate={fetchProjects} allGroups={allGroups} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((project) => (
              <ProjectCard key={project.path} project={project} onUpdate={fetchProjects} allGroups={allGroups} />
            ))}
          </div>
        )
      )}
      {/* 批次提交對話框 */}
      {showCommitDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCommitDialog(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-1">批次 Git 提交</h2>
            <p className="text-sm text-gray-400 mb-4">將對 {dirtyCount} 個有變更的專案執行 git add -A && git commit</p>
            <input
              type="text"
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBatchCommit()}
              placeholder="輸入 commit 訊息..."
              className="w-full bg-gray-800 text-gray-200 rounded-lg px-4 py-3 border border-gray-700 focus:border-amber-500 focus:outline-none mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowCommitDialog(false); setCommitMsg(""); }}
                className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleBatchCommit}
                disabled={committing || !commitMsg.trim()}
                className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg transition-colors text-white"
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
