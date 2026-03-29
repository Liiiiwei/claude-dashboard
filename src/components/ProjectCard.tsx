"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";

const TAG_COLORS: Record<string, string> = {
  "Next.js": "bg-blue-600",
  "Node.js": "bg-green-600",
  "Apps Script": "bg-yellow-600",
  "Chrome 擴充": "bg-purple-600",
  Python: "bg-sky-600",
  Docker: "bg-cyan-600",
  Git: "bg-gray-600",
  HTML: "bg-orange-600",
  n8n: "bg-rose-600",
};

function activityColor(isoDate: string): string {
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
  if (days <= 7) return "bg-green-400";
  if (days <= 30) return "bg-yellow-400";
  return "bg-gray-600";
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
}

export default function ProjectCard({ project, onUpdate, allGroups }: Props) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(project.note);
  const [devPort, setDevPort] = useState<number | null>(null);
  const [devLoading, setDevLoading] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [customGroup, setCustomGroup] = useState("");

  const handleOpen = async (action: "finder" | "vscode") => {
    try {
      const res = await fetch("/api/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: project.path, action }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "操作失敗");
      }
    } catch {
      alert("無法連線到伺服器");
    }
  };

  const saveNote = async () => {
    try {
      await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: project.name, field: "note", value: noteText }),
      });
      setEditingNote(false);
      onUpdate?.();
    } catch {
      alert("儲存備註失敗");
    }
  };

  const saveGroup = async (group: string) => {
    try {
      await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: project.name, field: "group", value: group }),
      });
      setShowGroupPicker(false);
      setCustomGroup("");
      onUpdate?.();
    } catch {
      alert("設定分組失敗");
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
      } else {
        alert(data.error || "啟動失敗");
      }
    } catch {
      alert("啟動失敗");
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition-colors">
      {/* 標題列 + 活躍度 */}
      <div className="flex items-start gap-2 mb-2">
        <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${activityColor(project.lastModified)}`} title="活躍度" />
        <h3 className="font-bold text-base break-words">{project.name}</h3>
      </div>

      {/* 描述 */}
      {project.description && (
        <p className="text-sm text-gray-400 mb-2 truncate">{project.description}</p>
      )}

      {/* Git 狀態 */}
      {project.git && (
        <div className="flex items-center gap-2 text-xs mb-2">
          <span className="text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
            ⎇ {project.git.branch}
          </span>
          {project.git.dirty > 0 && (
            <span className="text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded">
              {project.git.dirty} 個未提交
            </span>
          )}
        </div>
      )}

      {/* 分組 + 標籤 */}
      <div className="flex flex-wrap gap-1.5 mb-2 relative">
        <button
          onClick={() => setShowGroupPicker(!showGroupPicker)}
          className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
            project.group
              ? "bg-indigo-600 text-white hover:bg-indigo-500"
              : "bg-gray-800 text-gray-400 hover:text-gray-200 border border-dashed border-gray-600"
          }`}
        >
          {project.group || "+ 分組"}
        </button>
        {showGroupPicker && (
          <div className="absolute top-7 left-0 z-20 bg-gray-800 border border-gray-700 rounded-lg p-2 shadow-xl min-w-[160px]">
            {/* 合併預設 + 已有分組，去重 */}
            {Array.from(new Set([...DEFAULT_GROUPS, ...(allGroups || [])])).map((g) => (
              <button
                key={g}
                onClick={() => saveGroup(g)}
                className={`block w-full text-left px-3 py-1.5 text-xs rounded hover:bg-gray-700 transition-colors ${
                  project.group === g ? "text-indigo-400" : "text-gray-300"
                }`}
              >
                {g}
              </button>
            ))}
            <div className="border-t border-gray-700 mt-1 pt-1">
              <div className="flex gap-1">
                <input
                  type="text"
                  value={customGroup}
                  onChange={(e) => setCustomGroup(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && customGroup.trim() && saveGroup(customGroup.trim())}
                  placeholder="自訂分組..."
                  className="flex-1 bg-gray-900 text-xs px-2 py-1.5 rounded border border-gray-700 text-gray-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            {project.group && (
              <button
                onClick={() => saveGroup("")}
                className="block w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700 rounded mt-1 transition-colors"
              >
                移除分組
              </button>
            )}
          </div>
        )}
        {project.tags.map((tag) => (
          <span
            key={tag}
            className={`px-2 py-0.5 text-xs rounded-full text-white ${TAG_COLORS[tag] || "bg-gray-600"}`}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* 備註 */}
      {editingNote ? (
        <div className="mb-2">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="w-full bg-gray-800 text-gray-200 text-xs rounded p-2 border border-gray-700 resize-none"
            rows={2}
            placeholder="備註..."
            autoFocus
          />
          <div className="flex gap-1 mt-1">
            <button onClick={saveNote} className="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded text-white">儲存</button>
            <button onClick={() => { setEditingNote(false); setNoteText(project.note); }} className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">取消</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setEditingNote(true)}
          className="w-full text-left text-xs text-gray-500 hover:text-gray-300 mb-2 truncate transition-colors"
        >
          {project.note || "+ 新增備註"}
        </button>
      )}

      {/* 時間資訊 */}
      <div className="text-xs text-gray-500 truncate mb-3">
        {timeAgo(project.lastModified)} 更新
        {project.lastCommit && <span> · {project.lastCommit}</span>}
      </div>

      {/* 操作按鈕 */}
      <div className="flex gap-2">
        <button
          onClick={() => handleOpen("finder")}
          className="flex-1 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-center"
          title="在 Finder 中開啟"
        >
          Finder
        </button>
        <button
          onClick={() => handleOpen("vscode")}
          className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors text-center text-white"
          title="在 Antigravity 中開啟"
        >
          Antigravity
        </button>
      </div>

      {/* Dev Server 按鈕 */}
      {project.hasDevScript && (
        <div className="mt-2">
          {devPort ? (
            <a
              href={`http://localhost:${devPort}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center px-3 py-2 text-sm bg-green-600 hover:bg-green-500 rounded-lg transition-colors text-white"
            >
              localhost:{devPort}
            </a>
          ) : (
            <button
              onClick={startDevServer}
              disabled={devLoading}
              className="w-full px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {devLoading ? "啟動中..." : "啟動 Dev Server"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
