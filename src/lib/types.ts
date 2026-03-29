export type ProjectStatus = "待辦" | "進行中" | "已完成" | "暫停";

export const PROJECT_STATUSES: ProjectStatus[] = ["待辦", "進行中", "已完成", "暫停"];

export interface GitInfo {
  branch: string;
  dirty: number; // 未提交的檔案數
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
}

// 日常任務
export type TaskStatus = "待辦" | "進行中" | "已完成";

export interface DailyTask {
  id: string;
  text: string;
  status: TaskStatus;
  createdAt: string;
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
