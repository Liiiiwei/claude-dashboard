import { NextResponse } from "next/server";
import { access } from "fs/promises";
import { resolve } from "path";
import { scanDailyTasks, completeTasks } from "@/lib/daily-tasks";
import type { CompleteTaskEntry } from "@/lib/daily-tasks";
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

// PATCH: 把選定待辦在來源 Markdown 檔內就地勾銷（`- [ ]` → `- [x] … ✅ 日期`）。
//
// 請求 body：{ tasks: [{ sourceFile, lineNumber, text }] }
// 回傳：{ completed, failed, generatedAt }，failed 逐筆帶 { sourceFile, lineNumber, reason }。
//
// 資安：寫入邊界與逐筆校驗（路徑穿越、行號、內容相符）都在 completeTasks 內。
// 錯誤策略：body 非法（非物件／tasks 非陣列／欄位缺失或型別錯）回 400；
// 寫回層丟例外回 500 + { error }，絕不 crash。
export async function PATCH(request: Request) {
  // 解析 body：非 JSON 直接視為非法請求
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "請求內容不是合法 JSON" },
      { status: 400 },
    );
  }

  // 校驗 { tasks: [...] } 結構
  if (typeof body !== "object" || body === null || !("tasks" in body)) {
    return NextResponse.json({ error: "缺少 tasks 欄位" }, { status: 400 });
  }
  const rawTasks = (body as { tasks: unknown }).tasks;
  if (!Array.isArray(rawTasks)) {
    return NextResponse.json({ error: "tasks 必須是陣列" }, { status: 400 });
  }

  // 逐筆校驗欄位型別：sourceFile / text 為字串、lineNumber 為正整數
  const entries: CompleteTaskEntry[] = [];
  for (const item of rawTasks) {
    if (typeof item !== "object" || item === null) {
      return NextResponse.json(
        { error: "tasks 每筆必須是物件" },
        { status: 400 },
      );
    }
    const { sourceFile, lineNumber, text } = item as Record<string, unknown>;
    if (
      typeof sourceFile !== "string" ||
      typeof text !== "string" ||
      typeof lineNumber !== "number" ||
      !Number.isInteger(lineNumber) ||
      lineNumber < 1
    ) {
      return NextResponse.json(
        {
          error:
            "tasks 欄位不合法：需 sourceFile(字串)、lineNumber(正整數)、text(字串)",
        },
        { status: 400 },
      );
    }
    entries.push({ sourceFile, lineNumber, text });
  }

  try {
    const { completed, failed } = await completeTasks(entries);
    return NextResponse.json({
      completed,
      failed,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("勾銷日常任務失敗:", error);
    return NextResponse.json({ error: "勾銷日常任務失敗" }, { status: 500 });
  }
}
