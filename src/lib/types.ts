export type ProjectStatus = "待辦" | "進行中" | "已完成" | "暫停";

export const PROJECT_STATUSES: ProjectStatus[] = ["待辦", "進行中", "已完成", "暫停"];

export interface Project {
  name: string;
  description: string;
  path: string;
  tags: string[];
  lastModified: string; // ISO 8601
  lastCommit: string | null;
  status: ProjectStatus;
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
