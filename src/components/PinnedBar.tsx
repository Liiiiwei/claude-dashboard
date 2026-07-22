"use client";

import { useState, useRef, useEffect } from "react";
import type { Project } from "@/lib/types";
import { useToast } from "./ToastProvider";

interface Props {
  projects: Project[];
  onUnpin: (name: string) => void;
  onReorder?: (orderedNames: string[]) => void;
}

export default function PinnedBar({ projects, onUnpin, onReorder }: Props) {
  const { toast } = useToast();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // 鍵盤重排後要重新聚焦的項目名稱（避免焦點在 DOM 重排後遺失）
  const pendingFocusRef = useRef<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // 重排完成後把焦點還給剛移動的項目
  useEffect(() => {
    if (!pendingFocusRef.current) return;
    const el = itemRefs.current.get(pendingFocusRef.current);
    el?.focus();
    pendingFocusRef.current = null;
  }, [projects]);

  if (projects.length === 0) return null;

  const handleOpen = async (path: string, action: "finder" | "cmux") => {
    try {
      await fetch("/api/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, action }),
      });
    } catch {
      toast("開啟失敗", "error");
    }
  };

  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= projects.length || from === to) return;
    const next = [...projects];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    pendingFocusRef.current = moved.name;
    onReorder?.(next.map((p) => p.name));
  };

  const handleDrop = (toIndex: number) => {
    if (dragIndex === null || dragIndex === toIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    reorder(dragIndex, toIndex);
    setDragIndex(null);
    setOverIndex(null);
  };

  // Alt + ←/→ 作為拖移的鍵盤替代方案
  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (!e.altKey) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      reorder(idx, idx - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      reorder(idx, idx + 1);
    }
  };

  return (
    <div className="glass rounded-xl px-4 py-2.5 mb-5">
      <div
        className="flex items-center gap-3 overflow-x-auto"
        role="list"
        aria-label="常用專案（可用 Alt + 左右方向鍵調整順序）"
      >
        <span className="text-xs text-gray-500 shrink-0" aria-hidden>
          常用
        </span>
        {projects.map((p, idx) => {
          const isDragging = dragIndex === idx;
          const isOver = overIndex === idx && dragIndex !== idx;
          return (
            <div
              key={p.name}
              ref={(el) => {
                if (el) itemRefs.current.set(p.name, el);
                else itemRefs.current.delete(p.name);
              }}
              role="listitem"
              tabIndex={0}
              aria-label={`${p.name}，第 ${idx + 1} 個，共 ${projects.length} 個。按 Alt 加左右方向鍵調整順序`}
              draggable
              onDragStart={(e) => {
                setDragIndex(idx);
                // Firefox 需要 dragstart 期間 setData 才會啟動拖移
                e.dataTransfer.setData("text/plain", p.name);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overIndex !== idx) setOverIndex(idx);
              }}
              onDragLeave={() => {
                if (overIndex === idx) setOverIndex(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(idx);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`group relative flex items-center gap-2 shrink-0 cursor-grab active:cursor-grabbing transition-all focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:outline-none rounded-md ${
                isDragging ? "opacity-40" : ""
              } ${isOver ? "ring-2 ring-indigo-400/60" : ""}`}
              title="拖移或按 Alt + 左右方向鍵調整順序"
            >
              <span className="text-xs font-medium text-gray-700 max-w-[140px] truncate select-none">
                {p.name}
              </span>
              <button
                onClick={() => handleOpen(p.path, "cmux")}
                className="px-2 py-0.5 text-[10px] glass-button rounded-md font-medium"
                style={{ color: "#C26041" }}
                title="在 cmux 中啟動 Claude Code"
              >
                Claude
              </button>
              <button
                onClick={() => handleOpen(p.path, "finder")}
                className="px-2 py-0.5 text-[10px] glass-button rounded-md text-gray-500"
                title="Finder"
              >
                Finder
              </button>
              <button
                onClick={() => onUnpin(p.name)}
                aria-label={`取消釘選 ${p.name}`}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 absolute -top-1.5 -right-1.5 w-4 h-4 bg-white/90 hover:bg-red-100 backdrop-blur-md border border-white/50 rounded-full text-[9px] flex items-center justify-center transition-all text-gray-500 hover:text-red-500 shadow-sm"
                title="取消釘選"
              >
                <span aria-hidden>✕</span>
              </button>
              <span className="w-px h-4 bg-gray-300/40 ml-1" aria-hidden />
            </div>
          );
        })}
      </div>
    </div>
  );
}
