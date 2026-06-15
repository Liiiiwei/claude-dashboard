"use client";

import { useState } from "react";
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

  const handleDrop = (toIndex: number) => {
    if (dragIndex === null || dragIndex === toIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...projects];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(toIndex, 0, moved);
    onReorder?.(next.map((p) => p.name));
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div className="glass rounded-xl px-4 py-2.5 mb-5">
      <div className="flex items-center gap-3 overflow-x-auto">
        <span className="text-xs text-gray-400 shrink-0">常用</span>
        {projects.map((p, idx) => {
          const isDragging = dragIndex === idx;
          const isOver = overIndex === idx && dragIndex !== idx;
          return (
            <div
              key={p.name}
              draggable
              onDragStart={(e) => {
                setDragIndex(idx);
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
              className={`group relative flex items-center gap-2 shrink-0 cursor-grab active:cursor-grabbing transition-all ${
                isDragging ? "opacity-40" : ""
              } ${isOver ? "ring-2 ring-indigo-400/60 rounded-md" : ""}`}
              title="拖移以調整順序"
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
                className="opacity-0 group-hover:opacity-100 absolute -top-1.5 -right-1.5 w-4 h-4 bg-white/90 hover:bg-red-100 backdrop-blur-md border border-white/50 rounded-full text-[9px] flex items-center justify-center transition-all text-gray-400 hover:text-red-500 shadow-sm"
                title="取消釘選"
              >
                ✕
              </button>
              <span className="w-px h-4 bg-gray-300/40 ml-1" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
