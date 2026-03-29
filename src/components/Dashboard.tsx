"use client";

import { useState, useEffect, useCallback } from "react";
import type { Project, ProjectStatus } from "@/lib/types";
import ProjectCard from "./ProjectCard";
import FilterBar from "./FilterBar";
import SkeletonCard from "./SkeletonCard";
import KanbanBoard from "./KanbanBoard";

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("dashboard-tag") || "全部";
    return "全部";
  });
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

  // 依標籤篩選
  const filtered =
    activeTag === "全部"
      ? projects
      : projects.filter((p) => p.tags.includes(activeTag));

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
        <button
          onClick={fetchProjects}
          disabled={loading}
          className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
        >
          🔄 刷新
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {!loading && projects.length > 0 && (
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

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg">沒有找到任何專案</p>
          <p className="text-sm mt-2">
            {activeTag !== "全部"
              ? "嘗試切換篩選條件"
              : "請確認掃描目錄是否正確"}
          </p>
        </div>
      ) : (
        view === "kanban" ? (
          <KanbanBoard projects={sorted} onStatusChange={handleStatusChange} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((project) => (
              <ProjectCard key={project.path} project={project} />
            ))}
          </div>
        )
      )}
    </main>
  );
}
