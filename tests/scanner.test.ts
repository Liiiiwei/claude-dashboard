import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { register } from "node:module";

// 註冊 .ts 副檔名解析 hook，讓原始碼的 extensionless 相對匯入能被 Node 解析
register("./ts-ext-resolve.mjs", import.meta.url);

// 建立暫存 SCAN_DIR 當作掃描根目錄，再匯入 scanner。
// scanner 只導出 scanProjects，因此透過它的輸出間接驗證 detectTags / readDescription。
const root = await mkdtemp(join(tmpdir(), "scanner-root-"));
process.env.SCAN_DIR = root;

// 建立各種型別的專案 fixture（刻意不建 .git，避免觸發 git 子程序）
async function makeProject(name: string, files: Record<string, string>) {
  const dir = join(root, name);
  await mkdir(dir, { recursive: true });
  for (const [file, content] of Object.entries(files)) {
    await writeFile(join(dir, file), content);
  }
}

await makeProject("proj-next", {
  "package.json": JSON.stringify({ dependencies: { next: "16.0.0" } }),
});
await makeProject("proj-node", {
  "package.json": JSON.stringify({ dependencies: { express: "4.0.0" } }),
});
await makeProject("proj-python", {
  "main.py": "print('hi')",
});
await makeProject("proj-claude-desc", {
  "CLAUDE.md": "一些前言\n\n# 這是 CLAUDE 標題\n內文",
});
await makeProject("proj-readme-desc", {
  "README.md": "# 這是 README 標題\n內文",
});

const { scanProjects } = await import("../src/lib/scanner.ts");

test("detectTags：next 依賴標成 Next.js，非 next 標成 Node.js", async () => {
  const projects = await scanProjects();
  const byName = new Map(projects.map((p) => [p.name, p]));

  assert.ok(byName.get("proj-next")?.tags.includes("Next.js"));
  assert.ok(!byName.get("proj-next")?.tags.includes("Node.js"));
  assert.ok(byName.get("proj-node")?.tags.includes("Node.js"));
  assert.ok(!byName.get("proj-node")?.tags.includes("Next.js"));
});

test("detectTags：含 .py 檔標成 Python", async () => {
  const projects = await scanProjects();
  const py = projects.find((p) => p.name === "proj-python");
  assert.ok(py?.tags.includes("Python"));
});

test("readDescription：優先取第一個 # 標題（CLAUDE.md）", async () => {
  const projects = await scanProjects();
  const p = projects.find((x) => x.name === "proj-claude-desc");
  assert.equal(p?.description, "這是 CLAUDE 標題");
});

test("readDescription：無 CLAUDE.md 時退回 README.md 標題", async () => {
  const projects = await scanProjects();
  const p = projects.find((x) => x.name === "proj-readme-desc");
  assert.equal(p?.description, "這是 README 標題");
});

test.after(async () => {
  await rm(root, { recursive: true, force: true });
});
