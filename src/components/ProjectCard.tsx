"use client";

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

interface Props {
  project: Project;
}

export default function ProjectCard({ project }: Props) {
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

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition-colors">
      <div className="flex justify-between items-start mb-1">
        <h3 className="font-bold text-base truncate mr-2">{project.name}</h3>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => handleOpen("finder")}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded transition-colors"
            title="在 Finder 中開啟"
          >
            📂
          </button>
          <button
            onClick={() => handleOpen("vscode")}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded transition-colors"
            title="在 VS Code 中開啟"
          >
            ▶ Code
          </button>
        </div>
      </div>

      {project.description && (
        <p className="text-sm text-gray-400 mb-3 truncate">{project.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-3">
        {project.tags.map((tag) => (
          <span
            key={tag}
            className={`px-2 py-0.5 text-xs rounded-full text-white ${TAG_COLORS[tag] || "bg-gray-600"}`}
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="text-xs text-gray-500 truncate">
        {timeAgo(project.lastModified)} 更新
        {project.lastCommit && <span> · {project.lastCommit}</span>}
      </div>
    </div>
  );
}
