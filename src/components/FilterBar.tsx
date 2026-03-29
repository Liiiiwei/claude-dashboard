"use client";

interface Props {
  tags: string[];
  activeTag: string;
  onTagChange: (tag: string) => void;
  sortBy: "lastModified" | "name";
  onSortChange: (sort: "lastModified" | "name") => void;
  view: "list" | "kanban";
  onViewChange: (view: "list" | "kanban") => void;
}

export default function FilterBar({
  tags,
  activeTag,
  onTagChange,
  sortBy,
  onSortChange,
  view,
  onViewChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onTagChange("全部")}
          className={`px-4 py-2 text-sm rounded-full transition-colors ${
            activeTag === "全部"
              ? "bg-white text-gray-900"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          全部
        </button>
        {tags.map((tag) => (
          <button
            key={tag}
            onClick={() => onTagChange(tag)}
            className={`px-4 py-2 text-sm rounded-full transition-colors ${
              activeTag === tag
                ? "bg-white text-gray-900"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex bg-gray-800 rounded-lg overflow-hidden">
          <button
            onClick={() => onViewChange("list")}
            className={`px-5 py-2 text-sm font-medium transition-colors ${
              view === "list" ? "bg-gray-600 text-white" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            列表
          </button>
          <button
            onClick={() => onViewChange("kanban")}
            className={`px-5 py-2 text-sm font-medium transition-colors ${
              view === "kanban" ? "bg-gray-600 text-white" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            看板
          </button>
        </div>

        {view === "list" && (
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as "lastModified" | "name")}
            className="bg-gray-800 text-gray-300 text-sm rounded px-3 py-1.5 border border-gray-700"
          >
            <option value="lastModified">最近更新</option>
            <option value="name">名稱 A-Z</option>
          </select>
        )}
      </div>
    </div>
  );
}
