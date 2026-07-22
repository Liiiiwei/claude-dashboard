"use client";

import React, { useMemo, useState, useRef } from "react";
import type { Project, ProjectStatus } from "@/lib/types";
import { PROJECT_STATUSES } from "@/lib/types";
import { useToast } from "./ToastProvider";
import { useDismiss } from "@/lib/useDismiss";

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

function activityInfo(isoDate: string): { color: string; label: string } {
  const days = Math.floor(
    (Date.now() - new Date(isoDate).getTime()) / 86400000,
  );
  if (days <= 7)
    return { color: "bg-green-400", label: "活躍（一週內有更新）" };
  if (days <= 30)
    return { color: "bg-yellow-400", label: "普通（一個月內有更新）" };
  return { color: "bg-gray-400", label: "沉寂（超過一個月未更新）" };
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
  // 後端偵測不可用（degraded）時為 true：無法判定 dev server 是否在跑
  degraded?: boolean;
  // 專案清單載入中：此時狀態下拉不應可操作
  loading?: boolean;
  onDevServerStarted?: (projectPath: string, port: number) => void;
  // 回傳 boolean 代表成功與否，讓卡片能顯示 pending / 失敗回饋
  onStatusChange?: (
    name: string,
    status: ProjectStatus,
  ) => void | Promise<boolean>;
}

function ProjectCard({
  project,
  onUpdate,
  allGroups,
  runningPort = null,
  degraded = false,
  loading = false,
  onDevServerStarted,
  onStatusChange,
}: Props) {
  const { toast, confirm } = useToast();
  // 狀態變更進行中的目標值（樂觀顯示）；null 代表沒有進行中的變更
  const [pendingStatus, setPendingStatus] = useState<ProjectStatus | null>(
    null,
  );
  // 上一次變更失敗：短暫紅框回饋，值已回彈為 project.status
  const [statusFailed, setStatusFailed] = useState(false);
  const [devLoading, setDevLoading] = useState(false);
  const [openLoading, setOpenLoading] = useState<"finder" | "cmux" | null>(
    null,
  );
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [customGroup, setCustomGroup] = useState("");
  // 精簡態：預設收合，只顯示核心資訊；hover 或按展開鈕才顯示次要細節
  const [expanded, setExpanded] = useState(false);
  const groupPickerRef = useRef<HTMLDivElement>(null);

  // 點擊分組選單外面或按 Esc 時自動關閉
  useDismiss(showGroupPicker, groupPickerRef, () => setShowGroupPicker(false));

  // 分組候選清單（依 allGroups 變動才重算）
  const groupOptions = useMemo(
    () => Array.from(new Set([...DEFAULT_GROUPS, ...(allGroups || [])])),
    [allGroups],
  );

  const activity = activityInfo(project.lastModified);

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
    if (devLoading) return; // 重入保護
    setDevLoading(true);
    try {
      const res = await fetch("/api/dev-server", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: project.path, action: "start" }),
      });
      const data = await res.json();
      if (data.running) {
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

  // 次要細節的顯示條件：展開時恆顯示；收合時靠 group-hover 於 hover 顯示
  // （用 hidden/group-hover:block 而非高度動畫，避免分組選單彈層被 overflow 裁切）
  const detailVisibility = expanded ? "block" : "hidden group-hover:block";

  return (
    <div className="glass-card rounded-xl p-2.5 group">
      {/* 標題列（核心）：活躍度圓點 + 專案名 + running port + 展開鈕 + 釘選 + 隱藏 */}
      <div className="flex items-start gap-1.5">
        <span
          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${activity.color}`}
          aria-hidden
        />
        <span className="sr-only">{activity.label}</span>
        <h3 className="font-semibold text-sm break-words flex-1 text-gray-800 leading-tight">
          {project.name}
        </h3>
        {/* 執行中的 dev server：收合態也一眼可見（核心資訊） */}
        {runningPort && (
          <a
            href={`http://localhost:${runningPort}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 self-center px-1.5 py-0.5 text-[10px] leading-none rounded-full glass-green"
            title={`開啟 localhost:${runningPort}`}
          >
            :{runningPort}
          </a>
        )}
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={
            expanded
              ? `收合 ${project.name} 詳細資訊`
              : `展開 ${project.name} 詳細資訊`
          }
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-[10px] text-gray-400 hover:text-gray-700 transition-colors"
          title={expanded ? "收合詳細資訊" : "展開詳細資訊"}
        >
          <span
            aria-hidden
            className={`inline-block transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </button>
        <button
          onClick={handlePin}
          aria-label={
            project.pinned ? `取消釘選 ${project.name}` : `釘選 ${project.name}`
          }
          aria-pressed={project.pinned}
          className={`shrink-0 w-5 h-5 flex items-center justify-center rounded text-xs transition-colors ${
            project.pinned
              ? "text-amber-500 bg-amber-100/60"
              : "text-gray-500 hover:text-gray-700"
          }`}
          title={project.pinned ? "取消釘選" : "釘選"}
        >
          <span aria-hidden>{project.pinned ? "★" : "☆"}</span>
        </button>
        <button
          onClick={handleHide}
          aria-label={`隱藏專案 ${project.name}`}
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-[10px] text-gray-500 hover:text-red-500 transition-colors"
          title="隱藏此專案"
        >
          <span aria-hidden>✕</span>
        </button>
      </div>

      {/* 狀態變更（核心，收合態也顯示）；鍵盤可達的看板替代方案 */}
      {onStatusChange && (
        <div className="mt-1.5">
          <label className="sr-only" htmlFor={`status-${project.name}`}>
            變更「{project.name}」狀態
          </label>
          <select
            id={`status-${project.name}`}
            value={pendingStatus ?? project.status}
            disabled={loading || degraded || pendingStatus !== null}
            aria-busy={pendingStatus !== null}
            onChange={async (e) => {
              const next = e.target.value as ProjectStatus;
              setStatusFailed(false);
              setPendingStatus(next);
              // onStatusChange 可能回傳 void（看板拖移共用）或 Promise<boolean>
              const ok = await onStatusChange(project.name, next);
              // 失敗才顯示回饋；成功時 project.status 已由父層更新，值自然同步
              if (ok === false) setStatusFailed(true);
              setPendingStatus(null);
            }}
            className={`w-full glass-button rounded-lg px-2 py-1 text-[11px] text-gray-600 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${
              statusFailed ? "ring-1 ring-red-400/70" : ""
            }`}
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 次要細節（收合時隱藏）：hover 卡片或按展開鈕才顯示，降低卡片高度 */}
      <div
        className={`${detailVisibility} mt-1.5 pt-1.5 border-t border-white/30`}
      >
        {/* 描述 */}
        {project.description && (
          <p className="text-xs text-gray-500 mb-1.5 truncate">
            {project.description}
          </p>
        )}

        {/* Git 狀態 */}
        {project.git && (
          <div className="flex items-center gap-1.5 text-[11px] mb-1.5">
            <span className="text-gray-600 bg-white/40 px-1.5 py-0.5 rounded border border-white/50">
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
            aria-haspopup="menu"
            aria-expanded={showGroupPicker}
            className={`px-1.5 py-0.5 text-[11px] rounded-full transition-colors ${
              project.group
                ? "glass-accent text-indigo-600 font-medium"
                : "glass-button text-gray-500 border border-dashed border-gray-300/60"
            }`}
          >
            {project.group || "+ 分組"}
          </button>
          {showGroupPicker && (
            <div
              role="menu"
              className="absolute top-7 left-0 z-20 glass rounded-xl p-2 shadow-xl min-w-[160px]"
            >
              {groupOptions.map((g) => (
                <button
                  key={g}
                  role="menuitem"
                  onClick={() => saveGroup(g)}
                  className={`block w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-white/40 transition-colors ${
                    project.group === g
                      ? "text-indigo-600 font-medium"
                      : "text-gray-600"
                  }`}
                >
                  {g}
                </button>
              ))}
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
                    aria-label="自訂分組名稱"
                    className="flex-1 bg-white/30 text-xs px-2 py-1.5 rounded-lg border border-white/50 text-gray-700 focus:outline-none focus:border-indigo-400 placeholder:text-gray-500"
                  />
                </div>
              </div>
              {project.group && (
                <button
                  role="menuitem"
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
        <div className="text-[11px] text-gray-500 truncate mb-2">
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

        {/* Dev Server 按鈕：running port 已於標題列顯示，這裡只處理未執行 / 偵測不可用 */}
        {project.hasDevScript && !runningPort && (
          <div className="mt-1.5">
            {degraded ? (
              // 偵測不可用：無法判定是否在跑，避免誤示為「未執行」
              <div
                className="w-full px-2 py-1.5 text-xs glass-button rounded-lg text-center text-gray-500"
                title="無法偵測 dev server 狀態"
              >
                偵測不可用
              </div>
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
    </div>
  );
}

// React.memo 避免父元件 re-render 時（如 systemStats 更新）重繪未變更的卡片
export default React.memo(ProjectCard);
