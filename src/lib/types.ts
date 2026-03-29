export interface Project {
  name: string;
  description: string;
  path: string;
  tags: string[];
  lastModified: string; // ISO 8601
  lastCommit: string | null;
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
