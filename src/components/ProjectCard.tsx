"use client";

import React, { useState, useRef, useEffect } from "react";
import type { Project } from "@/lib/types";
import { useToast } from "./ToastProvider";

const TAG_COLORS: Record<string, string> = {
  "Next.js": "glass-blue",
  "Node.js": "glass-green",
  "Apps Script": "bg-yellow-500/20 text-yellow-700 border border-yellow-300/40",
  "Chrome 擴充": "bg-purple-500/15 text-purple-700 border border-purple-300/40",
  Python: "bg-sky-500/15 text-sky-700 border border-sky-300/40",
  Docker: "bg-cyan-500/15 text-cyan-700 border border-cyan-300/40",
  Git: "bg-gray-500/15 text-gray-600 border border-gray-300/40",
  HTML: "bg-orange-500/15 text-orange-700 border border-orange-300/40",
  n8n: "bg-rose-500/15 text-rose-700 border border-rose-300/40",
};

function activityColor(isoDate: string): string {
  const days = Math.floor(
    (Date.now() - new Date(isoDate).getTime()) / 86400000,
  );
  if (days <= 7) return "bg-green-400";
  if (days <= 30) return "bg-yellow-400";
  return "bg-gray-400";
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  return `${months} 個月前`;
}

const DEFAULT_GROUPS = ["個人專案", "公司專案", "線上課程", "練習", "工具"];

interface Props {
  project: Project;
  onUpdate?: () => void;
  allGroups?: string[];
  runningPort?: number | null;
  onDevServerStarted?: (projectPath: string, port: number) => void;
}

function ProjectCard({
  project,
  onUpdate,
  allGroups,
  runningPort = null,
  onDevServerStarted,
}: Props) {
  const { toast, confirm } = useToast();
  const [devPort, setDevPort] = useState<number | null>(runningPort);
  const [devLoading, setDevLoading] = useState(false);
  const [openLoading, setOpenLoading] = useState<"finder" | "cmux" | null>(
    null,
  );
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [customGroup, setCustomGroup] = useState("");
  const groupPickerRef = useRef<HTMLDivElement>(null);

  // 後端偵測到的執行狀態（runningPort）變動時同步本地顯示
  useEffect(() => {
    setDevPort(runningPort);
  }, [runningPort]);

  // 點擊分組選單外面時自動關閉
  useEffect(() => {
    if (!showGroupPicker) return;
    const handler = (e: MouseEvent) => {
      if (
        groupPickerRef.current &&
        !groupPickerRef.current.contains(e.target as Node)
      ) {
        setShowGroupPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showGroupPicker]);

  const handleOpen = async (action: "finder" | "cmux") => {
    if (openLoading) return;
    setOpenLoading(action);
    try {
      const res = await fetch("/api/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: project.path, action }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast(data.error || "操作失敗", "error");
      }
    } catch {
      toast("無法連線到伺服器", "error");
    } finally {
      setOpenLoading(null);
    }
  };

  const saveGroup = async (group: string) => {
    try {
      await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: project.name,
          field: "group",
          value: group,
        }),
      });
      setShowGroupPicker(false);
      setCustomGroup("");
      onUpdate?.();
    } catch {
      toast("設定分組失敗", "error");
    }
  };

  const handleHide = async () => {
    const ok = await confirm(
      `確定要隱藏「${project.name}」？可在篩選列的「已隱藏」中恢復。`,
    );
    if (!ok) return;
    try {
      await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "_settings",
          field: "exclude",
          value: project.name,
        }),
      });
      onUpdate?.();
    } catch {
      toast("隱藏失敗", "error");
    }
  };

  const handlePin = async () => {
    try {
      await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: project.name,
          field: "pinned",
          value: !project.pinned,
        }),
      });
      onUpdate?.();
    } catch {
      toast("釘選失敗", "error");
    }
  };

  const startDevServer = async () => {
    setDevLoading(true);
    try {
      const res = await fetch("/api/dev-server", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: project.path, action: "start" }),
      });
      const data = await res.json();
      if (data.running) {
        setDevPort(data.port);
        onDevServerStarted?.(project.path, data.port);
        toast(`已啟動 localhost:${data.port}`, "success");
      } else {
        toast(data.error || "啟動失敗", "error");
      }
    } catch {
      toast("啟動失敗", "error");
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-xl p-2.5">
      {/* 標題列 + 活躍度 */}
      <div className="flex items-start gap-1.5 mb-1">
        <span
          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${activityColor(project.lastModified)}`}
          title="活躍度"
        />
        <h3 className="font-semibold text-sm break-words flex-1 text-gray-800 leading-tight">
          {project.name}
        </h3>
        <button
          onClick={handlePin}
          className={`shrink-0 w-5 h-5 flex items-center justify-center rounded text-xs transition-colors ${
            project.pinned
              ? "text-amber-500 bg-amber-100/60"
              : "text-gray-400 hover:text-gray-600"
          }`}
          title={project.pinned ? "取消釘選" : "釘選"}
        >
          {project.pinned ? "★" : "☆"}
        </button>
        <button
          onClick={handleHide}
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-[10px] text-gray-400 hover:text-red-500 transition-colors"
          title="隱藏此專案"
        >
          ✕
        </button>
      </div>

      {/* 描述 */}
      {project.description && (
        <p className="text-xs text-gray-500 mb-1.5 truncate">
          {project.description}
        </p>
      )}

      {/* Git 狀態 */}
      {project.git && (
        <div className="flex items-center gap-1.5 text-[11px] mb-1.5">
          <span className="text-gray-500 bg-white/40 px-1.5 py-0.5 rounded border border-white/50">
            ⎇ {project.git.branch}
          </span>
          {project.git.dirty > 0 && (
            <span className="text-amber-700 bg-amber-100/60 px-1.5 py-0.5 rounded border border-amber-200/50">
              {project.git.dirty} 未提交
            </span>
          )}
        </div>
      )}

      {/* 分組 + 標籤 */}
      <div
        className="flex flex-wrap gap-1 mb-1.5 relative"
        ref={groupPickerRef}
      >
        <button
          onClick={() => setShowGroupPicker(!showGroupPicker)}
          className={`px-1.5 py-0.5 text-[11px] rounded-full transition-colors ${
            project.group
              ? "glass-accent text-indigo-600 font-medium"
              : "glass-button text-gray-400 border border-dashed border-gray-300/60"
          }`}
        >
          {project.group || "+ 分組"}
        </button>
        {showGroupPicker && (
          <div className="absolute top-7 left-0 z-20 glass rounded-xl p-2 shadow-xl min-w-[160px]">
            {Array.from(new Set([...DEFAULT_GROUPS, ...(allGroups || [])])).map(
              (g) => (
                <button
                  key={g}
                  onClick={() => saveGroup(g)}
                  className={`block w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-white/40 transition-colors ${
                    project.group === g
                      ? "text-indigo-600 font-medium"
                      : "text-gray-600"
                  }`}
                >
                  {g}
                </button>
              ),
            )}
            <div className="border-t border-white/40 mt-1 pt-1">
              <div className="flex gap-1">
                <input
                  type="text"
                  value={customGroup}
                  onChange={(e) => setCustomGroup(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    customGroup.trim() &&
                    saveGroup(customGroup.trim())
                  }
                  placeholder="自訂分組..."
                  className="flex-1 bg-white/30 text-xs px-2 py-1.5 rounded-lg border border-white/50 text-gray-700 focus:outline-none focus:border-indigo-400 placeholder:text-gray-400"
                />
              </div>
            </div>
            {project.group && (
              <button
                onClick={() => saveGroup("")}
                className="block w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-white/40 rounded-lg mt-1 transition-colors"
              >
                移除分組
              </button>
            )}
          </div>
        )}
        {project.tags.map((tag) => (
          <span
            key={tag}
            className={`px-1.5 py-0.5 text-[11px] rounded-full ${TAG_COLORS[tag] || "bg-gray-500/15 text-gray-600 border border-gray-300/40"}`}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* 時間資訊 */}
      <div className="text-[11px] text-gray-400 truncate mb-2">
        {timeAgo(project.lastModified)} 更新
        {project.lastCommit && <span> · {project.lastCommit}</span>}
      </div>

      {/* 操作按鈕 */}
      <div className="flex gap-1.5">
        <button
          onClick={() => handleOpen("finder")}
          disabled={openLoading !== null}
          className="flex-1 px-2 py-1.5 text-xs glass-button rounded-lg text-center text-gray-600 disabled:opacity-60"
          title="在 Finder 中開啟"
        >
          {openLoading === "finder" ? "開啟中…" : "Finder"}
        </button>
        <button
          onClick={() => handleOpen("cmux")}
          disabled={openLoading !== null}
          className="flex-1 px-2 py-1.5 text-xs glass-button rounded-lg text-center font-medium disabled:opacity-60"
          style={{ color: "#C26041" }}
          title="在 cmux 中啟動 Claude Code"
        >
          {openLoading === "cmux" ? "啟動中…" : "Claude Code"}
        </button>
      </div>

      {/* Dev Server 按鈕 */}
      {project.hasDevScript && (
        <div className="mt-1.5">
          {devPort ? (
            <a
              href={`http://localhost:${devPort}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center px-2 py-1.5 text-xs glass-green rounded-lg"
            >
              localhost:{devPort}
            </a>
          ) : (
            <button
              onClick={startDevServer}
              disabled={devLoading}
              className="w-full px-2 py-1.5 text-xs glass-button rounded-lg text-gray-600 disabled:opacity-50"
            >
              {devLoading ? "啟動中..." : "啟動 Dev"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// React.memo 避免父元件 re-render 時（如 systemStats 更新）重繪未變更的卡片
export default React.memo(ProjectCard);
