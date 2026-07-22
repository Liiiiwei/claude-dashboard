import { NextResponse } from "next/server";
import { access } from "fs/promises";
import { resolve } from "path";
import { scanDailyTasks } from "@/lib/daily-tasks";
import { OBSIDIAN_VAULT } from "@/lib/paths";

export const dynamic = "force-dynamic";

// GET: 掃描 Obsidian vault 的跨客戶待辦，回傳分組後的 DailyTasksResponse。
//
// 資安：只讀白名單 vault 目錄（OBSIDIAN_VAULT）下的 *.md，路徑防護在 scanDailyTasks 內。
// 錯誤策略：vault 根目錄不存在／不可讀時回 500 + { error }（與 projects／ports route 一致），
// 絕不 crash。vault 存在但無待辦則正常回傳空的四組（由前端 hook 判為 empty）。
export async function GET() {
  const root = resolve(OBSIDIAN_VAULT);

  // 先確認 vault 根目錄可讀，區分「vault 不存在」與「vault 內沒待辦」
  try {
    await access(root);
  } catch {
    console.error("Obsidian vault 不存在或不可讀:", root);
    return NextResponse.json(
      { error: "找不到 Obsidian vault，請確認 OBSIDIAN_VAULT 路徑" },
      { status: 500 },
    );
  }

  try {
    const data = await scanDailyTasks(root);
    return NextResponse.json(data);
  } catch (error) {
    console.error("掃描日常任務失敗:", error);
    return NextResponse.json({ error: "掃描日常任務失敗" }, { status: 500 });
  }
}
