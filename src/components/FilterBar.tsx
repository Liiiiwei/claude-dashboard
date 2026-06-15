"use client";

import { useState, useEffect, useRef } from "react";
import { useToast } from "./ToastProvider";

interface Props {
  tags: string[];
  activeTag: string;
  onTagChange: (tag: string) => void;
  sortBy: "lastModified" | "name";
  onSortChange: (sort: "lastModified" | "name") => void;
  view: "list" | "kanban";
  onViewChange: (view: "list" | "kanban") => void;
  onUpdate?: () => void;
}

export default function FilterBar({
  tags,
  activeTag,
  onTagChange,
  sortBy,
  onSortChange,
  view,
  onViewChange,
  onUpdate,
}: Props) {
  const { toast } = useToast();
  const [showExcluded, setShowExcluded] = useState(false);
  const [excludePatterns, setExcludePatterns] = useState<string[]>([]);
  const excludedRef = useRef<HTMLDivElement>(null);

  // 點擊「已隱藏」面板外面時自動關閉
  useEffect(() => {
    if (!showExcluded) return;
    const handler = (e: MouseEvent) => {
      if (
        excludedRef.current &&
        !excludedRef.current.contains(e.target as Node)
      ) {
        setShowExcluded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExcluded]);

  const fetchExcluded = async () => {
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "_settings", field: "excludePatterns" }),
      });
      const data = await res.json();
      setExcludePatterns(data.patterns || []);
    } catch {
      /* 靜默 */
    }
  };

  useEffect(() => {
    if (showExcluded) fetchExcluded();
  }, [showExcluded]);

  const handleRestore = async (pattern: string) => {
    try {
      await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "_settings",
          field: "unexclude",
          value: pattern,
        }),
      });
      setExcludePatterns((prev) => prev.filter((p) => p !== pattern));
      onUpdate?.();
    } catch {
      toast("恢復失敗", "error");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-5">
      <button
        onClick={() => onTagChange("全部")}
        className={`px-3 py-1.5 text-xs rounded-full transition-all ${
          activeTag === "全部"
            ? "glass-button-active text-gray-900 font-medium"
            : "glass-button text-gray-600"
        }`}
      >
        全部
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => onTagChange(tag)}
          className={`px-3 py-1.5 text-xs rounded-full transition-all ${
            activeTag === tag
              ? "glass-button-active text-gray-900 font-medium"
              : "glass-button text-gray-600"
          }`}
        >
          {tag}
        </button>
      ))}

      {/* 排序 */}
      <select
        value={sortBy}
        onChange={(e) =>
          onSortChange(e.target.value as "lastModified" | "name")
        }
        className="ml-auto px-2 py-1 text-xs rounded-lg glass-button text-gray-600 focus:outline-none"
      >
        <option value="lastModified">最近更新</option>
        <option value="name">名稱</option>
      </select>

      {/* 檢視模式 */}
      <div className="flex rounded-xl overflow-hidden border border-white/50">
        <button
          onClick={() => onViewChange("kanban")}
          className={`px-2.5 py-1 text-xs transition-all ${
            view === "kanban" ? "glass-blue" : "glass-button text-gray-500"
          }`}
        >
          看板
        </button>
        <button
          onClick={() => onViewChange("list")}
          className={`px-2.5 py-1 text-xs transition-all ${
            view === "list" ? "glass-blue" : "glass-button text-gray-500"
          }`}
        >
          列表
        </button>
      </div>

      {/* 已隱藏管理 */}
      <div className="relative" ref={excludedRef}>
        <button
          onClick={() => setShowExcluded(!showExcluded)}
          className="px-3 py-1.5 text-xs rounded-full glass-button text-gray-400 hover:text-gray-600 transition-colors"
        >
          已隱藏
        </button>
        {showExcluded && (
          <div className="absolute right-0 top-9 z-30 rounded-xl p-3 min-w-[200px] bg-white/95 backdrop-blur-xl border border-white/60 shadow-lg">
            <p className="text-[11px] text-gray-400 mb-2">已隱藏的專案</p>
            {excludePatterns.length === 0 ? (
              <p className="text-xs text-gray-400 py-2 text-center">
                沒有隱藏的專案
              </p>
            ) : (
              <div className="space-y-1">
                {excludePatterns.map((pattern) => (
                  <div
                    key={pattern}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-xs text-gray-600 truncate">
                      {pattern}
                    </span>
                    <button
                      onClick={() => handleRestore(pattern)}
                      className="text-[10px] text-blue-500 hover:text-blue-700 shrink-0 transition-colors"
                    >
                      恢復
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
