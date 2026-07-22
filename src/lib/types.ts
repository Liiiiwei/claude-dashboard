export type ProjectStatus = "待辦" | "進行中" | "已完成" | "暫停";

export const PROJECT_STATUSES: ProjectStatus[] = [
  "待辦",
  "進行中",
  "已完成",
  "暫停",
];

export interface GitInfo {
  branch: string;
  dirty: number; // 未提交的檔案數
  remoteUrl: string | null; // git remote origin URL
  totalCommits: number | null;
}

export interface Project {
  name: string;
  description: string;
  path: string;
  tags: string[];
  lastModified: string;
  lastCommit: string | null;
  status: ProjectStatus;
  note: string;
  group: string;
  git: GitInfo | null;
  hasDevScript: boolean; // 有沒有 npm run dev
  priority: number; // 欄位內排序
  pinned: boolean; // 常用專案釘選
  pinOrder: number; // 釘選列順序，數字越小越前面
  scripts: string[]; // package.json 中的 scripts
  depsCount: number | null; // 相依套件數量
  runningPort: number | null; // 目前正在執行的 dev server port，未執行為 null
}

// ── 日常任務（跨客戶待辦）契約 ──
// 前端面板會直接 import 下列型別，欄位名為對外契約，請勿隨意更動。

// 單條待辦。來源為 Obsidian vault 各專案 Markdown 檔 `## 待辦事項` 下的 `- [ ]` 行。
export interface DailyTask {
  text: string; // 乾淨待辦文字（已去除 #tag、@負責人、📅 日期等 metadata）
  client: string; // 客戶／專案名（= 來源檔名去 .md）
  owner: string | null; // @負責人，無則為 null
  due: string | null; // 📅 到期日 YYYY-MM-DD，無則為 null
  tags: string[]; // 行內所有 #tag（不含 # 前綴）
  category: "ai-auto" | "ai-draft" | "human" | "uncategorized"; // 依 tag 分組
  sourceFile: string; // 來源相對路徑（相對於 vault 根）
}

// /api/daily-tasks 的回傳形狀。groups 依 category 分組，counts 為各組計數。
export interface DailyTasksResponse {
  groups: Record<DailyTask["category"], DailyTask[]>;
  counts: Record<DailyTask["category"], number>;
  generatedAt: string; // ISO 8601 產生時間
}

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
