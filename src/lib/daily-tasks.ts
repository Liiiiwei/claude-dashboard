import { readdir, readFile } from "fs/promises";
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
// client：客戶／專案名；sourceFile：來源相對路徑。
export function parseTaskLine(
  line: string,
  client: string,
  sourceFile: string,
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
  };
}

// 解析整份檔案內容，逐行抓未完成待辦。純函式。
export function parseTasksFromContent(
  content: string,
  client: string,
  sourceFile: string,
): DailyTask[] {
  const tasks: DailyTask[] = [];
  for (const line of content.split("\n")) {
    const task = parseTaskLine(line, client, sourceFile);
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

export { CATEGORIES };
