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
