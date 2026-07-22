import { readdir, readFile, writeFile } from "fs/promises";
import { join, resolve, relative, isAbsolute, sep } from "path";
import { OBSIDIAN_VAULT, TASK_SUBDIRS } from "./paths";
import type { DailyTask, DailyTasksResponse } from "./types";

// ── 純函式解析層 ──
// 這一層完全不碰檔案系統，方便用 fixture 字串測試。

// 待辦分組類別，含 uncategorized 共四類。順序即為分組優先序。
const CATEGORIES: DailyTask["category"][] = [
  "ai-auto",
  "ai-draft",
  "human",
  "uncategorized",
];

// 未完成待辦：行首（可含縮排）為 `- [ ]`。
// 刻意只認空格勾選框 `[ ]`，排除 `[x]`（已完成）與 `[-]`（已取消）。
const UNCHECKED_RE = /^\s*-\s+\[ \]\s+(.*)$/;

// 行內標籤：Obsidian 慣例，# 後須以「非數字」字元起頭（純數字如 #5 不算標籤），
// 可含中英數、底線、連字號、斜線。用來排除文字中的 `#5`、`#7` 這類編號引用。
const TAG_RE = /#([A-Za-z一-鿿_][\w一-鿿/-]*)/g;

// @負責人：@ 後接中英數／底線，遇到空白或其他符號即止。
const OWNER_RE = /@([\w一-鿿]+)/;

// 📅 到期日：Tasks 外掛格式 `📅 YYYY-MM-DD`。
const DUE_RE = /📅\s*(\d{4}-\d{2}-\d{2})/;

// 依標籤決定分組類別。已知標籤優先序 ai-auto > ai-draft > human，皆無則 uncategorized。
function categorize(tags: string[]): DailyTask["category"] {
  if (tags.includes("ai-auto")) return "ai-auto";
  if (tags.includes("ai-draft")) return "ai-draft";
  if (tags.includes("human")) return "human";
  return "uncategorized";
}

// 從待辦原始文字抽出乾淨文字：移除所有 #tag、@負責人、📅 日期，並收斂多餘空白。
function cleanText(raw: string): string {
  return raw
    .replace(TAG_RE, "")
    .replace(new RegExp(OWNER_RE.source, "g"), "")
    .replace(new RegExp(DUE_RE.source, "g"), "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// 解析單行。若非未完成待辦則回傳 null。純函式，不觸檔案系統。
// client：客戶／專案名；sourceFile：來源相對路徑；lineNumber：該行 1-based 行號（預設 1）。
export function parseTaskLine(
  line: string,
  client: string,
  sourceFile: string,
  lineNumber: number = 1,
): DailyTask | null {
  const match = line.match(UNCHECKED_RE);
  if (!match) return null;
  const body = match[1];

  // 抽出所有標籤（去掉 # 前綴）
  const tags: string[] = [];
  for (const m of body.matchAll(TAG_RE)) {
    tags.push(m[1]);
  }

  const ownerMatch = body.match(OWNER_RE);
  const owner = ownerMatch ? ownerMatch[1] : null;

  const dueMatch = body.match(DUE_RE);
  const due = dueMatch ? dueMatch[1] : null;

  return {
    text: cleanText(body),
    client,
    owner,
    due,
    tags,
    category: categorize(tags),
    sourceFile,
    lineNumber,
  };
}

// 解析整份檔案內容，逐行抓未完成待辦。純函式。
// 每筆待辦帶入其相對 sourceFile 的實際行號（1-based）。
export function parseTasksFromContent(
  content: string,
  client: string,
  sourceFile: string,
): DailyTask[] {
  const tasks: DailyTask[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const task = parseTaskLine(lines[i], client, sourceFile, i + 1);
    if (task) tasks.push(task);
  }
  return tasks;
}

// 依 category 分組並計數。純函式，保證四個 key 都存在（空陣列 / 0）。
export function groupTasks(tasks: DailyTask[]): {
  groups: DailyTasksResponse["groups"];
  counts: DailyTasksResponse["counts"];
} {
  const groups = {
    "ai-auto": [] as DailyTask[],
    "ai-draft": [] as DailyTask[],
    human: [] as DailyTask[],
    uncategorized: [] as DailyTask[],
  };
  for (const task of tasks) {
    groups[task.category].push(task);
  }
  const counts = {
    "ai-auto": groups["ai-auto"].length,
    "ai-draft": groups["ai-draft"].length,
    human: groups["human"].length,
    uncategorized: groups["uncategorized"].length,
  };
  return { groups, counts };
}

// 判斷該檔名是否為待掃描的待辦檔：*.md 且非底線開頭的聚合檔（_全客戶待辦.md 等）。
export function isTaskFile(fileName: string): boolean {
  return fileName.endsWith(".md") && !fileName.startsWith("_");
}

// ── 檔案系統層 ──

// 路徑防護：確認目標檔案實際落在 vault 根目錄之內，擋掉 ../ 穿越。
function isWithinVault(vaultRoot: string, target: string): boolean {
  const rel = relative(vaultRoot, target);
  // rel 以 ".." 起頭或為絕對路徑，代表跳出了 vault
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

// 掃描指定 vault，回傳分組後的完整結果。
// vaultRoot 預設為 OBSIDIAN_VAULT；只讀 TASK_SUBDIRS 下的 *.md（略過 _ 開頭聚合檔）。
// 找不到目錄時視為空結果由呼叫端處理錯誤；此函式對「單一子目錄不存在」採容錯（略過）。
export async function scanDailyTasks(
  vaultRoot: string = OBSIDIAN_VAULT,
): Promise<DailyTasksResponse> {
  const root = resolve(vaultRoot);
  const allTasks: DailyTask[] = [];

  for (const subdir of TASK_SUBDIRS) {
    const dirPath = join(root, subdir);
    let entries: string[];
    try {
      entries = await readdir(dirPath);
    } catch {
      // 子目錄不存在或不可讀：略過，不讓單一目錄缺失拖垮整體
      continue;
    }

    for (const fileName of entries) {
      if (!isTaskFile(fileName)) continue;

      const filePath = join(dirPath, fileName);
      // 路徑防護：確保仍在 vault 內（擋 symlink／異常檔名穿越）
      if (!isWithinVault(root, filePath)) continue;

      let content: string;
      try {
        content = await readFile(filePath, "utf-8");
      } catch {
        continue; // 單檔讀取失敗不影響其他檔
      }

      const client = fileName.replace(/\.md$/, "");
      // 來源相對路徑（相對 vault 根），統一用正斜線呈現
      const sourceFile = relative(root, filePath).split(sep).join("/");
      allTasks.push(...parseTasksFromContent(content, client, sourceFile));
    }
  }

  const { groups, counts } = groupTasks(allTasks);
  return {
    groups,
    counts,
    generatedAt: new Date().toISOString(),
  };
}

// ── 勾銷寫回層 ──
// 受控的破壞性寫入：把 vault 內某待辦行的 `- [ ]` 就地改為 `- [x] … ✅ 日期`。
// 安全性優先：逐筆校驗路徑邊界、行號、內容相符，任一不符即記為 failed 且不動檔案。

// 單筆勾銷請求：來源相對路徑、1-based 行號、對應待辦的乾淨文字（用來防誤勾）。
export interface CompleteTaskEntry {
  sourceFile: string;
  lineNumber: number;
  text: string;
}

// 勾銷結果：completed 為成功筆數，failed 逐筆帶原始定位與失敗原因。
export interface CompleteTasksResult {
  completed: number;
  failed: Array<{ sourceFile: string; lineNumber: number; reason: string }>;
}

// 取得 Asia/Taipei 當地日期，格式 YYYY-MM-DD。
// 用 en-CA locale 產出 ISO 樣式日期，並固定時區，不受 server 時區影響。
export function taipeiToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// 逐筆勾銷。一筆失敗不中斷其他筆。
// vaultRoot 預設 OBSIDIAN_VAULT；today 預設 taipeiToday()（測試可注入固定日期）。
export async function completeTasks(
  entries: CompleteTaskEntry[],
  vaultRoot: string = OBSIDIAN_VAULT,
  today: string = taipeiToday(),
): Promise<CompleteTasksResult> {
  const root = resolve(vaultRoot);
  const failed: CompleteTasksResult["failed"] = [];
  let completed = 0;

  for (const entry of entries) {
    const { sourceFile, lineNumber, text } = entry;
    const fail = (reason: string) =>
      failed.push({ sourceFile, lineNumber, reason });

    // 1. 路徑邊界防護：解析為 vault 內絕對路徑，擋 ../ 穿越與越界寫入
    const filePath = resolve(root, sourceFile);
    if (!isWithinVault(root, filePath)) {
      fail("path-outside-vault");
      continue;
    }

    // 2. 讀檔：不存在或不可讀即失敗，不動任何檔案
    let content: string;
    try {
      content = await readFile(filePath, "utf-8");
    } catch {
      fail("file-not-found");
      continue;
    }

    // 3. 定位行號（1-based）。超出範圍視為對不上
    const lines = content.split("\n");
    const idx = lineNumber - 1;
    if (idx < 0 || idx >= lines.length) {
      fail("line-out-of-range");
      continue;
    }

    // 保留可能的 CRLF 行尾，處理時先剝離 \r，寫回時補回
    const rawLine = lines[idx];
    const hasCR = rawLine.endsWith("\r");
    const line = hasCR ? rawLine.slice(0, -1) : rawLine;

    // 4. 校驗該行仍是未完成待辦（`- [ ]` 開頭）
    const parsed = parseTaskLine(line, "", sourceFile, lineNumber);
    if (!parsed) {
      // 已勾銷 [x] / 已取消 [-] 給明確原因，其餘視為對不上
      fail(
        /^\s*-\s+\[[xX-]\]/.test(line) ? "already-completed" : "line-mismatch",
      );
      continue;
    }

    // 5. 校驗待辦文字與傳入 text 相符，防止行號錯位誤勾別的待辦
    if (parsed.text !== text) {
      fail("line-mismatch");
      continue;
    }

    // 6. 校驗通過才就地改行：首個 `[ ]` → `[x]`，行尾補 ` ✅ 日期`，保留縮排與其餘內容
    const updated = line.replace("[ ]", "[x]") + ` ✅ ${today}`;
    lines[idx] = hasCR ? updated + "\r" : updated;

    await writeFile(filePath, lines.join("\n"), "utf-8");
    completed += 1;
  }

  return { completed, failed };
}

export { CATEGORIES };
