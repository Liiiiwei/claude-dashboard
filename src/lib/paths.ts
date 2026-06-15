import { join } from "path";

// 掃描目錄：所有專案的根目錄。集中定義，避免各處重複硬編。
export const SCAN_DIR =
  process.env.SCAN_DIR ||
  join(process.env.HOME || "", "Desktop", "vibe-coding playground");
