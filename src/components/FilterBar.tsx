"use client";

interface Props {
  tags: string[];
  activeTag: string;
  onTagChange: (tag: string) => void;
  sortBy: "lastModified" | "name";
  onSortChange: (sort: "lastModified" | "name") => void;
}

export default function FilterBar({
  tags,
  activeTag,
  onTagChange,
  sortBy,
  onSortChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onTagChange("全部")}
          className={`px-3 py-1 text-sm rounded-full transition-colors ${
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
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              activeTag === tag
                ? "bg-white text-gray-900"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as "lastModified" | "name")}
        className="bg-gray-800 text-gray-300 text-sm rounded px-3 py-1.5 border border-gray-700"
      >
        <option value="lastModified">最近更新</option>
        <option value="name">名稱 A-Z</option>
      </select>
    </div>
  );
}
