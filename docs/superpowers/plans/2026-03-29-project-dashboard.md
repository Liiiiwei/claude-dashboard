# 專案管理儀表板 MVP 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一個本機運行的專案管理儀表板，掃描 `~/Desktop/vibe-coding playground/` 並以卡片形式呈現所有專案，支援一鍵開啟 Finder/VS Code。

**Architecture:** Next.js 15 App Router 單頁應用。前端用 React Server Component 搭配 Client Component 處理互動。後端用 API Routes 掃描檔案系統、執行系統指令。無資料庫，每次請求即時掃描。

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS 4

---

## 檔案結構

```
claude-dashboard/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # 根 layout，深色主題全域樣式
│   │   ├── page.tsx            # 首頁，Server Component 入口
│   │   ├── globals.css         # Tailwind 引入 + 全域 CSS
│   │   └── api/
│   │       ├── projects/
│   │       │   └── route.ts    # GET /api/projects — 掃描目錄
│   │       └── open/
│   │           └── route.ts    # POST /api/open — 開啟 Finder/VS Code
│   ├── components/
│   │   ├── Dashboard.tsx       # Client Component — 主儀表板（篩選、排序、卡片列表）
│   │   ├── ProjectCard.tsx     # 單張專案卡片
│   │   ├── FilterBar.tsx       # 篩選列 + 排序
│   │   └── SkeletonCard.tsx    # 載入中骨架卡片
│   └── lib/
│       ├── scanner.ts          # 掃描邏輯：讀目錄、偵測類型、擷取資訊
│       └── types.ts            # TypeScript 型別定義
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
└── postcss.config.mjs
```

---

### Task 1: 專案初始化

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: 用 create-next-app 初始化專案**

```bash
cd "/Users/vincentsia/Desktop/vibe-coding playground/claude dashboard"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
```

選項：全部用預設值。這會建立 Next.js 15 + Tailwind CSS + TypeScript + App Router 專案。

- [ ] **Step 2: 確認專案可以啟動**

```bash
npm run dev
```

預期：瀏覽器開啟 `http://localhost:3000` 看到 Next.js 預設首頁。確認後 Ctrl+C 關閉。

- [ ] **Step 3: 清理預設內容，設定深色主題基底**

替換 `src/app/globals.css`：

```css
@import "tailwindcss";
```

替換 `src/app/layout.tsx`：

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "專案儀表板",
  description: "本機專案管理儀表板",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
```

替換 `src/app/page.tsx`：

```tsx
export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">專案儀表板</h1>
      <p className="text-gray-400 mt-2">載入中...</p>
    </main>
  );
}
```

- [ ] **Step 4: 確認深色主題正常顯示**

```bash
npm run dev
```

預期：`http://localhost:3000` 顯示深色背景 + 白色文字「專案儀表板」。確認後 Ctrl+C。

- [ ] **Step 5: 初始化 Git 並提交**

```bash
git init
echo "node_modules/\n.next/\n.superpowers/" > .gitignore
git add .
git commit -m "feat: 初始化 Next.js 專案，深色主題基底"
```

---

### Task 2: 型別定義與掃描邏輯

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/scanner.ts`

- [ ] **Step 1: 定義 TypeScript 型別**

建立 `src/lib/types.ts`：

```ts
export interface Project {
  name: string;
  description: string;
  path: string;
  tags: string[];
  lastModified: string; // ISO 8601
  lastCommit: string | null;
}

// 所有可能的標籤值
export const TAG_LABELS = [
  "Next.js",
  "Node.js",
  "Apps Script",
  "Chrome 擴充",
  "Python",
  "Docker",
  "Git",
  "HTML",
  "n8n",
] as const;

export type TagLabel = (typeof TAG_LABELS)[number];
```

- [ ] **Step 2: 實作掃描邏輯**

建立 `src/lib/scanner.ts`：

```ts
import { readdir, stat, readFile, access } from "fs/promises";
import { join } from "path";
import { execSync } from "child_process";
import type { Project } from "./types";

const SCAN_DIR =
  process.env.SCAN_DIR ||
  join(process.env.HOME || "", "Desktop", "vibe-coding playground");

// 偵測專案類型標籤
async function detectTags(projectPath: string): Promise<string[]> {
  const tags: string[] = [];

  const exists = async (filename: string) => {
    try {
      await access(join(projectPath, filename));
      return true;
    } catch {
      return false;
    }
  };

  // 檢查 package.json
  if (await exists("package.json")) {
    try {
      const pkg = JSON.parse(
        await readFile(join(projectPath, "package.json"), "utf-8")
      );
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };
      if (allDeps["next"]) {
        tags.push("Next.js");
      } else {
        tags.push("Node.js");
      }
    } catch {
      tags.push("Node.js");
    }
  }

  // Apps Script
  if (await exists("appsscript.json")) {
    tags.push("Apps Script");
  }

  // Chrome 擴充
  if (await exists("manifest.json")) {
    try {
      const manifest = JSON.parse(
        await readFile(join(projectPath, "manifest.json"), "utf-8")
      );
      if (manifest.manifest_version) {
        tags.push("Chrome 擴充");
      }
    } catch {
      // 非 Chrome 擴充的 manifest.json
    }
  }

  // Python
  const files = await readdir(projectPath);
  if (files.some((f) => f.endsWith(".py"))) {
    tags.push("Python");
  }

  // Docker
  if (await exists("Dockerfile")) {
    tags.push("Docker");
  }

  // Git
  if (await exists(".git")) {
    tags.push("Git");
  }

  // n8n — JSON 檔包含 nodes 和 connections
  const jsonFiles = files.filter(
    (f) => f.endsWith(".json") && f !== "package.json" && f !== "manifest.json" && f !== "appsscript.json" && f !== "tsconfig.json"
  );
  for (const jsonFile of jsonFiles) {
    try {
      const content = JSON.parse(
        await readFile(join(projectPath, jsonFile), "utf-8")
      );
      if (content.nodes && content.connections) {
        tags.push("n8n");
        break;
      }
    } catch {
      // 不是有效 JSON
    }
  }

  // HTML — 只有 HTML 檔案（無其他語言標籤時）
  if (
    tags.length === 0 ||
    (tags.length === 1 && tags[0] === "Git")
  ) {
    if (files.some((f) => f.endsWith(".html"))) {
      tags.push("HTML");
    }
  }

  return tags;
}

// 讀取專案描述（CLAUDE.md 或 README.md 的第一個標題）
async function readDescription(projectPath: string): Promise<string> {
  for (const filename of ["CLAUDE.md", "README.md"]) {
    try {
      const content = await readFile(
        join(projectPath, filename),
        "utf-8"
      );
      const lines = content.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        const match = line.match(/^#\s+(.+)/);
        if (match) return match[1].trim();
      }
      // 沒有 # 標題，取第一行非空行
      if (lines.length > 0) return lines[0].trim();
    } catch {
      // 檔案不存在，繼續下一個
    }
  }
  return "";
}

// 取得最近一次 commit 訊息
function getLastCommit(projectPath: string): string | null {
  try {
    const result = execSync('git log -1 --format="%s"', {
      cwd: projectPath,
      timeout: 3000,
      encoding: "utf-8",
    });
    return result.trim().replace(/^"|"$/g, "") || null;
  } catch {
    return null;
  }
}

// 掃描所有專案
export async function scanProjects(): Promise<Project[]> {
  const entries = await readdir(SCAN_DIR, { withFileTypes: true });

  const projects: Project[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectPath = join(SCAN_DIR, entry.name);
    const projectStat = await stat(projectPath);

    const [tags, description] = await Promise.all([
      detectTags(projectPath),
      readDescription(projectPath),
    ]);

    projects.push({
      name: entry.name,
      description,
      path: projectPath,
      tags,
      lastModified: projectStat.mtime.toISOString(),
      lastCommit: tags.includes("Git")
        ? getLastCommit(projectPath)
        : null,
    });
  }

  // 預設依最後更新排序（最新在前）
  projects.sort(
    (a, b) =>
      new Date(b.lastModified).getTime() -
      new Date(a.lastModified).getTime()
  );

  return projects;
}
```

- [ ] **Step 3: 手動驗證掃描邏輯**

建立一個臨時測試腳本 `test-scan.ts`（之後刪除）：

```bash
npx tsx -e "
import { scanProjects } from './src/lib/scanner';
scanProjects().then(p => console.log(JSON.stringify(p, null, 2)));
"
```

預期：輸出 JSON 陣列，包含 `vibe-coding playground/` 底下約 20+ 個專案，每個都有 name、tags、lastModified 等欄位。

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/scanner.ts
git commit -m "feat: 專案掃描邏輯與型別定義"
```

---

### Task 3: API Routes

**Files:**
- Create: `src/app/api/projects/route.ts`
- Create: `src/app/api/open/route.ts`

- [ ] **Step 1: 實作 GET /api/projects**

建立 `src/app/api/projects/route.ts`：

```ts
import { NextResponse } from "next/server";
import { scanProjects } from "@/lib/scanner";

// 不快取，每次請求都重新掃描
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await scanProjects();
    return NextResponse.json(projects);
  } catch (error) {
    console.error("掃描專案失敗:", error);
    return NextResponse.json(
      { error: "掃描專案失敗" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 實作 POST /api/open**

建立 `src/app/api/open/route.ts`：

```ts
import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { access } from "fs/promises";

export async function POST(request: NextRequest) {
  const { path, action } = await request.json();

  // 驗證路徑存在
  try {
    await access(path);
  } catch {
    return NextResponse.json(
      { error: "路徑不存在" },
      { status: 400 }
    );
  }

  // 驗證 action
  if (action !== "finder" && action !== "vscode") {
    return NextResponse.json(
      { error: "不支援的操作" },
      { status: 400 }
    );
  }

  try {
    if (action === "finder") {
      execSync(`open "${path}"`);
    } else {
      execSync(`code "${path}"`);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("開啟失敗:", error);
    return NextResponse.json(
      { error: "開啟失敗" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: 驗證 API**

```bash
npm run dev &
sleep 3
curl http://localhost:3000/api/projects | head -c 500
kill %1
```

預期：回傳 JSON 陣列，內含專案資訊。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/
git commit -m "feat: API routes — 專案掃描與開啟操作"
```

---

### Task 4: 骨架卡片元件

**Files:**
- Create: `src/components/SkeletonCard.tsx`

- [ ] **Step 1: 建立 SkeletonCard 元件**

建立 `src/components/SkeletonCard.tsx`：

```tsx
export default function SkeletonCard() {
  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 animate-pulse">
      {/* 名稱 */}
      <div className="h-5 bg-gray-800 rounded w-3/5 mb-3" />
      {/* 描述 */}
      <div className="h-4 bg-gray-800 rounded w-4/5 mb-4" />
      {/* 標籤列 */}
      <div className="flex gap-2 mb-4">
        <div className="h-6 bg-gray-800 rounded-full w-16" />
        <div className="h-6 bg-gray-800 rounded-full w-12" />
      </div>
      {/* 底部資訊 */}
      <div className="h-3 bg-gray-800 rounded w-full" />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SkeletonCard.tsx
git commit -m "feat: 骨架卡片元件"
```

---

### Task 5: ProjectCard 元件

**Files:**
- Create: `src/components/ProjectCard.tsx`

- [ ] **Step 1: 建立 ProjectCard 元件**

建立 `src/components/ProjectCard.tsx`：

```tsx
"use client";

import type { Project } from "@/lib/types";

// 標籤顏色對應
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

// 相對時間顯示
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
      {/* 標題列 */}
      <div className="flex justify-between items-start mb-1">
        <h3 className="font-bold text-base truncate mr-2">
          {project.name}
        </h3>
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

      {/* 描述 */}
      {project.description && (
        <p className="text-sm text-gray-400 mb-3 truncate">
          {project.description}
        </p>
      )}

      {/* 標籤 */}
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

      {/* 底部資訊 */}
      <div className="text-xs text-gray-500 truncate">
        {timeAgo(project.lastModified)} 更新
        {project.lastCommit && (
          <span> · {project.lastCommit}</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ProjectCard.tsx
git commit -m "feat: 專案卡片元件"
```

---

### Task 6: FilterBar 元件

**Files:**
- Create: `src/components/FilterBar.tsx`

- [ ] **Step 1: 建立 FilterBar 元件**

建立 `src/components/FilterBar.tsx`：

```tsx
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
      {/* 篩選標籤 */}
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

      {/* 排序 */}
      <select
        value={sortBy}
        onChange={(e) =>
          onSortChange(e.target.value as "lastModified" | "name")
        }
        className="bg-gray-800 text-gray-300 text-sm rounded px-3 py-1.5 border border-gray-700"
      >
        <option value="lastModified">最近更新</option>
        <option value="name">名稱 A-Z</option>
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FilterBar.tsx
git commit -m "feat: 篩選列元件"
```

---

### Task 7: Dashboard 主元件 — 整合所有元件

**Files:**
- Create: `src/components/Dashboard.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 建立 Dashboard 元件**

建立 `src/components/Dashboard.tsx`：

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Project } from "@/lib/types";
import ProjectCard from "./ProjectCard";
import FilterBar from "./FilterBar";
import SkeletonCard from "./SkeletonCard";

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState("全部");
  const [sortBy, setSortBy] = useState<"lastModified" | "name">(
    "lastModified"
  );

  const fetchProjects = useCallback(async () => {
    try {
      setError(null);
      // 只有在沒有資料時才顯示 loading
      if (projects.length === 0) setLoading(true);

      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("掃描失敗");

      const data: Project[] = await res.json();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知錯誤");
    } finally {
      setLoading(false);
    }
  }, [projects.length]);

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 收集所有不重複的標籤（排除 Git，因為太普遍）
  const allTags = Array.from(
    new Set(projects.flatMap((p) => p.tags.filter((t) => t !== "Git")))
  ).sort();

  // 篩選
  const filtered =
    activeTag === "全部"
      ? projects
      : projects.filter((p) => p.tags.includes(activeTag));

  // 排序
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    return (
      new Date(b.lastModified).getTime() -
      new Date(a.lastModified).getTime()
    );
  });

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* 標題列 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">專案儀表板</h1>
          <p className="text-gray-400 text-sm mt-1">
            {projects.length} 個專案
          </p>
        </div>
        <button
          onClick={fetchProjects}
          disabled={loading}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm transition-colors"
        >
          🔄 刷新
        </button>
      </div>

      {/* 錯誤提示 */}
      {error && (
        <div className="bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* 篩選列 */}
      {!loading && projects.length > 0 && (
        <FilterBar
          tags={allTags}
          activeTag={activeTag}
          onTagChange={setActiveTag}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      )}

      {/* 卡片列表 */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg">沒有找到任何專案</p>
          <p className="text-sm mt-2">
            {activeTag !== "全部"
              ? "嘗試切換篩選條件"
              : "請確認掃描目錄是否正確"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((project) => (
            <ProjectCard key={project.path} project={project} />
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: 更新首頁引用 Dashboard**

替換 `src/app/page.tsx`：

```tsx
import Dashboard from "@/components/Dashboard";

export default function Home() {
  return <Dashboard />;
}
```

- [ ] **Step 3: 完整功能驗證**

```bash
npm run dev
```

開啟 `http://localhost:3000`，驗證：
1. 顯示骨架卡片 → 載入完成後顯示專案卡片
2. 每張卡片有名稱、描述、標籤、更新時間
3. 篩選標籤可以正常切換
4. 排序下拉選單可以切換
5. 📂 按鈕開啟 Finder
6. ▶ Code 按鈕開啟 VS Code
7. 🔄 刷新按鈕重新載入

- [ ] **Step 4: Commit**

```bash
git add src/components/Dashboard.tsx src/app/page.tsx
git commit -m "feat: Dashboard 主元件，整合篩選排序與卡片"
```

---

### Task 8: 建置檢查與收尾

**Files:**
- Modify: 視需要修正的檔案

- [ ] **Step 1: 執行 build 確認無錯誤**

```bash
npm run build
```

預期：建置成功，無 TypeScript 或 ESLint 錯誤。

- [ ] **Step 2: 如有錯誤，修復後重新 build**

根據錯誤訊息修復，直到 `npm run build` 成功。

- [ ] **Step 3: 最終提交**

```bash
git add -A
git commit -m "chore: 建置通過，MVP 完成"
```
