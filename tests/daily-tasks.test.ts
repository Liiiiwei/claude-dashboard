import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
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
