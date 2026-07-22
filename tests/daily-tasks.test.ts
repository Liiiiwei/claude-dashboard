import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { register } from "node:module";

// 註冊 .ts 副檔名解析 hook，讓原始碼的 extensionless 相對匯入能被 Node 解析
register("./ts-ext-resolve.mjs", import.meta.url);

const {
  parseTaskLine,
  parseTasksFromContent,
  groupTasks,
  isTaskFile,
  scanDailyTasks,
  completeTasks,
  taipeiToday,
} = await import("../src/lib/daily-tasks.ts");

// ── 純函式：單行解析 ──

test("parseTaskLine：抽出乾淨文字、tag、@負責人、📅 日期", () => {
  const task = parseTaskLine(
    "- [ ] 每週五更新秋季班 ROAS 追蹤表 #ai-auto @Liwei 📅 2026-07-31",
    "宇皇",
    "02-Projects/接案專案/宇皇.md",
  );
  assert.ok(task);
  assert.equal(task.text, "每週五更新秋季班 ROAS 追蹤表");
  assert.deepEqual(task.tags, ["ai-auto"]);
  assert.equal(task.owner, "Liwei");
  assert.equal(task.due, "2026-07-31");
  assert.equal(task.category, "ai-auto");
  assert.equal(task.client, "宇皇");
  assert.equal(task.sourceFile, "02-Projects/接案專案/宇皇.md");
});

test("parseTaskLine：無 tag / 負責人 / 日期 → uncategorized、null", () => {
  const task = parseTaskLine("- [ ] 確認上線時程", "冠球印刷", "x.md");
  assert.ok(task);
  assert.equal(task.text, "確認上線時程");
  assert.deepEqual(task.tags, []);
  assert.equal(task.owner, null);
  assert.equal(task.due, null);
  assert.equal(task.category, "uncategorized");
});

test("parseTaskLine：@客戶 中文負責人也能抽出", () => {
  const task = parseTaskLine(
    "- [ ] 兒童肖像權同意書盤點 #human @客戶 📅 2026-07-25",
    "魔法科學班",
    "x.md",
  );
  assert.ok(task);
  assert.equal(task.owner, "客戶");
  assert.equal(task.category, "human");
});

test("parseTaskLine：已完成 [x] 與取消 [-] 一律排除", () => {
  assert.equal(
    parseTaskLine("- [x] 已完成的事 ✅ 2026-04-26", "c", "x.md"),
    null,
  );
  assert.equal(parseTaskLine("- [-] 取消的事", "c", "x.md"), null);
  assert.equal(parseTaskLine("一般文字不是待辦", "c", "x.md"), null);
});

test("parseTaskLine：純數字 #5 不算 tag（排除編號引用）", () => {
  const task = parseTaskLine("- [ ] 修 #5 腳本 #ai-draft", "c", "x.md");
  assert.ok(task);
  assert.deepEqual(task.tags, ["ai-draft"]);
  assert.equal(task.category, "ai-draft");
});

// ── 純函式：分組 ──

test("groupTasks：依 tag 正確分組並計數，四組 key 恆存在", () => {
  const content = [
    "- [ ] A #ai-auto",
    "- [ ] B #ai-draft",
    "- [ ] C #human",
    "- [ ] D 沒有標籤",
    "- [x] E #human 已完成",
  ].join("\n");
  const tasks = parseTasksFromContent(content, "客戶", "x.md");
  assert.equal(tasks.length, 4); // [x] 被排除
  const { groups, counts } = groupTasks(tasks);
  assert.equal(counts["ai-auto"], 1);
  assert.equal(counts["ai-draft"], 1);
  assert.equal(counts.human, 1);
  assert.equal(counts.uncategorized, 1);
  assert.equal(groups["ai-auto"][0].text, "A");
  assert.equal(groups.uncategorized[0].text, "D 沒有標籤");
});

// ── isTaskFile ──

test("isTaskFile：略過 _ 開頭聚合檔與非 .md", () => {
  assert.equal(isTaskFile("宇皇.md"), true);
  assert.equal(isTaskFile("_全客戶待辦.md"), false);
  assert.equal(isTaskFile("_報價追蹤.md"), false);
  assert.equal(isTaskFile("note.txt"), false);
});

// ── 檔案系統層：scanDailyTasks 用 tmp vault ──

test("scanDailyTasks：只掃兩個子目錄、略過 _ 檔、正確分組", async () => {
  const vault = await mkdtemp(join(tmpdir(), "vault-"));
  const clientDir = join(vault, "02-Projects", "接案專案");
  const companyDir = join(vault, "02-Projects", "公司專案");
  await mkdir(clientDir, { recursive: true });
  await mkdir(companyDir, { recursive: true });

  await writeFile(
    join(clientDir, "宇皇.md"),
    [
      "## 待辦事項",
      "- [ ] 客戶待辦一 #human @客戶 📅 2026-07-15",
      "- [x] 已完成 ✅ 2026-04-26",
      "- [ ] 客戶待辦二 #ai-auto @Liwei",
    ].join("\n"),
  );
  await writeFile(
    join(companyDir, "哇哉上課.md"),
    "- [ ] 公司待辦 #ai-draft @Liwei 📅 2026-08-01\n",
  );
  // _ 開頭聚合檔應被略過
  await writeFile(
    join(clientDir, "_全客戶待辦.md"),
    "- [ ] 不該出現的聚合待辦 #human\n",
  );

  const res = await scanDailyTasks(vault);

  assert.equal(res.counts.human, 1);
  assert.equal(res.counts["ai-auto"], 1);
  assert.equal(res.counts["ai-draft"], 1);
  assert.equal(res.counts.uncategorized, 0);
  // _ 檔的待辦不得混入
  const allTexts = [
    ...res.groups.human,
    ...res.groups["ai-auto"],
    ...res.groups["ai-draft"],
  ].map((t) => t.text);
  assert.ok(!allTexts.includes("不該出現的聚合待辦"));
  // sourceFile 為相對 vault 的正斜線路徑
  assert.equal(
    res.groups["ai-auto"][0].sourceFile,
    "02-Projects/接案專案/宇皇.md",
  );
  assert.equal(res.groups["ai-auto"][0].client, "宇皇");
  assert.ok(typeof res.generatedAt === "string");

  await rm(vault, { recursive: true, force: true });
});

test("scanDailyTasks：vault 子目錄不存在時容錯回空結果", async () => {
  const vault = await mkdtemp(join(tmpdir(), "vault-empty-"));
  const res = await scanDailyTasks(vault);
  assert.equal(res.counts.human, 0);
  assert.equal(res.counts["ai-auto"], 0);
  assert.equal(res.counts["ai-draft"], 0);
  assert.equal(res.counts.uncategorized, 0);
  await rm(vault, { recursive: true, force: true });
});

// ── lineNumber：解析行號正確 ──

test("parseTaskLine：帶入 1-based lineNumber", () => {
  const task = parseTaskLine("- [ ] 做一件事", "c", "x.md", 7);
  assert.ok(task);
  assert.equal(task.lineNumber, 7);
});

test("parseTasksFromContent：lineNumber 對應各待辦的實際行號", () => {
  const content = [
    "## 待辦事項", // 行 1
    "- [ ] A #ai-auto", // 行 2
    "一般文字", // 行 3
    "- [x] 已完成", // 行 4（排除）
    "- [ ] B #human", // 行 5
  ].join("\n");
  const tasks = parseTasksFromContent(content, "客戶", "x.md");
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].text, "A");
  assert.equal(tasks[0].lineNumber, 2);
  assert.equal(tasks[1].text, "B");
  assert.equal(tasks[1].lineNumber, 5);
});

// ── 日期格式 ──

test("taipeiToday：回傳 YYYY-MM-DD 格式", () => {
  assert.match(taipeiToday(), /^\d{4}-\d{2}-\d{2}$/);
});

// ── completeTasks 勾銷寫回層 ──

// 建一個含待辦子目錄的 tmp vault，回傳 vault 根與檔案相對路徑
async function makeVault(fileContent: string): Promise<{
  vault: string;
  sourceFile: string;
  filePath: string;
}> {
  const vault = await mkdtemp(join(tmpdir(), "vault-write-"));
  const clientDir = join(vault, "02-Projects", "接案專案");
  await mkdir(clientDir, { recursive: true });
  const filePath = join(clientDir, "宇皇.md");
  await writeFile(filePath, fileContent);
  return { vault, sourceFile: "02-Projects/接案專案/宇皇.md", filePath };
}

test("completeTasks：正常勾銷把 - [ ] 改為 - [x] 並補 ✅ 日期", async () => {
  const { vault, sourceFile, filePath } = await makeVault(
    ["## 待辦事項", "- [ ] 客戶待辦一 #human @客戶 📅 2026-07-15", ""].join(
      "\n",
    ),
  );
  const res = await completeTasks(
    [{ sourceFile, lineNumber: 2, text: "客戶待辦一" }],
    vault,
    "2026-07-22",
  );
  assert.equal(res.completed, 1);
  assert.deepEqual(res.failed, []);
  const after = await readFile(filePath, "utf-8");
  assert.match(
    after,
    /- \[x\] 客戶待辦一 #human @客戶 📅 2026-07-15 ✅ 2026-07-22/,
  );
  // 其他行不受影響
  assert.ok(after.startsWith("## 待辦事項\n"));
  await rm(vault, { recursive: true, force: true });
});

test("completeTasks：保留縮排", async () => {
  const { vault, sourceFile, filePath } = await makeVault("\t- [ ] 縮排待辦\n");
  const res = await completeTasks(
    [{ sourceFile, lineNumber: 1, text: "縮排待辦" }],
    vault,
    "2026-07-22",
  );
  assert.equal(res.completed, 1);
  const after = await readFile(filePath, "utf-8");
  assert.match(after, /^\t- \[x\] 縮排待辦 ✅ 2026-07-22/);
  await rm(vault, { recursive: true, force: true });
});

test("completeTasks：行已勾銷 → already-completed，不改檔", async () => {
  const { vault, sourceFile, filePath } = await makeVault(
    "- [x] 已完成的事 ✅ 2026-04-26\n",
  );
  const before = await readFile(filePath, "utf-8");
  const res = await completeTasks(
    [{ sourceFile, lineNumber: 1, text: "已完成的事" }],
    vault,
    "2026-07-22",
  );
  assert.equal(res.completed, 0);
  assert.equal(res.failed[0].reason, "already-completed");
  assert.equal(await readFile(filePath, "utf-8"), before); // 未被改動
  await rm(vault, { recursive: true, force: true });
});

test("completeTasks：文字不符 → line-mismatch，不改檔", async () => {
  const { vault, sourceFile, filePath } = await makeVault("- [ ] 真正的待辦\n");
  const before = await readFile(filePath, "utf-8");
  const res = await completeTasks(
    [{ sourceFile, lineNumber: 1, text: "別的待辦" }],
    vault,
    "2026-07-22",
  );
  assert.equal(res.completed, 0);
  assert.equal(res.failed[0].reason, "line-mismatch");
  assert.equal(await readFile(filePath, "utf-8"), before);
  await rm(vault, { recursive: true, force: true });
});

test("completeTasks：path traversal 被擋 → path-outside-vault", async () => {
  const { vault } = await makeVault("- [ ] x\n");
  const res = await completeTasks(
    [
      {
        sourceFile: "../../../../../../etc/passwd",
        lineNumber: 1,
        text: "x",
      },
    ],
    vault,
    "2026-07-22",
  );
  assert.equal(res.completed, 0);
  assert.equal(res.failed[0].reason, "path-outside-vault");
  await rm(vault, { recursive: true, force: true });
});

test("completeTasks：檔案不存在 → file-not-found", async () => {
  const { vault } = await makeVault("- [ ] x\n");
  const res = await completeTasks(
    [
      {
        sourceFile: "02-Projects/接案專案/不存在.md",
        lineNumber: 1,
        text: "x",
      },
    ],
    vault,
    "2026-07-22",
  );
  assert.equal(res.completed, 0);
  assert.equal(res.failed[0].reason, "file-not-found");
  await rm(vault, { recursive: true, force: true });
});

test("completeTasks：行號超出範圍 → line-out-of-range", async () => {
  const { vault, sourceFile } = await makeVault("- [ ] x\n");
  const res = await completeTasks(
    [{ sourceFile, lineNumber: 99, text: "x" }],
    vault,
    "2026-07-22",
  );
  assert.equal(res.completed, 0);
  assert.equal(res.failed[0].reason, "line-out-of-range");
  await rm(vault, { recursive: true, force: true });
});

test("completeTasks：一筆失敗不中斷其他筆（部分成功）", async () => {
  const { vault, sourceFile, filePath } = await makeVault(
    ["- [ ] 待辦甲", "- [ ] 待辦乙"].join("\n"),
  );
  const res = await completeTasks(
    [
      { sourceFile, lineNumber: 1, text: "對不上的字" }, // 失敗
      { sourceFile, lineNumber: 2, text: "待辦乙" }, // 成功
    ],
    vault,
    "2026-07-22",
  );
  assert.equal(res.completed, 1);
  assert.equal(res.failed.length, 1);
  assert.equal(res.failed[0].reason, "line-mismatch");
  const after = await readFile(filePath, "utf-8");
  assert.match(after, /- \[ \] 待辦甲/); // 甲維持未勾
  assert.match(after, /- \[x\] 待辦乙 ✅ 2026-07-22/); // 乙已勾
  await rm(vault, { recursive: true, force: true });
});
