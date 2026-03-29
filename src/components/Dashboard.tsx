"use client";

import { useState, useEffect, useCallback } from "react";
import type { Project } from "@/lib/types";
import ProjectCard from "./ProjectCard";
import FilterBar from "./FilterBar";
import SkeletonCard from "./SkeletonCard";

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState("全部");
  const [sortBy, setSortBy] = useState<"lastModified" | "name">("lastModified");

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
          <p className="text-gray-400 text-sm mt-1">
            {projects.length} 個專案
          </p>
        </div>
        <button
          onClick={fetchProjects}
          disabled={loading}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm transition-colors"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((project) => (
            <ProjectCard key={project.path} project={project} />
          ))}
        </div>
      )}
    </main>
  );
}
