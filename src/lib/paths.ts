import { join } from "path";

// 掃描目錄：所有專案的根目錄。集中定義，避免各處重複硬編。
export const SCAN_DIR =
  process.env.SCAN_DIR ||
  join(process.env.HOME || "", "Desktop", "vibe-coding playground");

// Obsidian vault 根目錄：跨客戶待辦的來源。可用環境變數 OBSIDIAN_VAULT 覆寫，
// 預設指向使用者的 FlowPilot vault。集中定義，避免各處重複硬編。
export const OBSIDIAN_VAULT =
  process.env.OBSIDIAN_VAULT ||
  join(process.env.HOME || "", "Desktop", "Obsidian FlowPilot");

// vault 內要掃描待辦的子資料夾（相對於 OBSIDIAN_VAULT）。
// 只掃這兩個目錄下的 *.md，其他目錄一律略過。
export const TASK_SUBDIRS = [
  join("02-Projects", "接案專案"),
  join("02-Projects", "公司專案"),
] as const;
