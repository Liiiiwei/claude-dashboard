"use client";

import type { Project } from "@/lib/types";

interface Props {
  projects: Project[];
  onUnpin: (name: string) => void;
}

export default function PinnedBar({ projects, onUnpin }: Props) {
  if (projects.length === 0) return null;

  const handleOpen = async (path: string, action: "finder" | "vscode") => {
    try {
      await fetch("/api/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, action }),
      });
    } catch {
      alert("開啟失敗");
    }
  };

  return (
    <div className="glass rounded-xl px-4 py-2.5 mb-5">
      <div className="flex items-center gap-3 overflow-x-auto">
        <span className="text-xs text-gray-400 shrink-0">常用</span>
        {projects.map((p) => (
          <div
            key={p.name}
            className="group relative flex items-center gap-2 shrink-0"
          >
            <span className="text-xs font-medium text-gray-700 max-w-[140px] truncate">{p.name}</span>
            <button
              onClick={() => handleOpen(p.path, "vscode")}
              className="px-2 py-0.5 text-[10px] glass-blue rounded-md"
              title="Antigravity"
            >
              開啟
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
            {/* 分隔線 */}
            <span className="w-px h-4 bg-gray-300/40 ml-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
