import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { register } from "node:module";

// 註冊 .ts 副檔名解析 hook，讓原始碼的 extensionless 相對匯入能被 Node 解析
register("./ts-ext-resolve.mjs", import.meta.url);

// 先建立一個真實的暫存目錄當作 SCAN_DIR，再匯入 api-guard（isPathAllowed 會用它做 realpath 比對）。
// 必須在動態 import 之前設好 env —— paths.ts 在載入時就固定 SCAN_DIR。
const root = await mkdtemp(join(tmpdir(), "scan-root-"));
process.env.SCAN_DIR = root;
const { isPathAllowed, checkOrigin } = await import("../src/lib/api-guard.ts");

// 用最小結構模擬 NextRequest（checkOrigin 只讀 headers）
function mkReq(headers: Record<string, string>) {
  return { headers: new Headers(headers) } as unknown as Parameters<
    typeof checkOrigin
  >[0];
}

test("checkOrigin 放行 localhost Origin，擋掉外部 Origin", () => {
  assert.equal(checkOrigin(mkReq({ origin: "http://localhost:3001" })), null);
  assert.equal(checkOrigin(mkReq({ origin: "http://127.0.0.1:3001" })), null);
  assert.notEqual(checkOrigin(mkReq({ origin: "http://evil.com" })), null);
});

test("checkOrigin 無 Origin 時依 Sec-Fetch-Site 白名單放行/攔阻", () => {
  // 同源前端 fetch：same-origin → 放行
  assert.equal(checkOrigin(mkReq({ "sec-fetch-site": "same-origin" })), null);
  assert.equal(checkOrigin(mkReq({ "sec-fetch-site": "none" })), null);
  // 惡意跨站送來（無 Origin 但 Sec-Fetch-Site=cross-site）→ 擋下
  assert.notEqual(checkOrigin(mkReq({ "sec-fetch-site": "cross-site" })), null);
});

test("checkOrigin 非瀏覽器（無 Origin 無 Sec-Fetch）僅在 Host 為本機時放行", () => {
  // curl 打本機：無 Origin、無 Sec-Fetch-Site、Host=localhost → 放行
  assert.equal(checkOrigin(mkReq({ host: "localhost:3001" })), null);
  assert.equal(checkOrigin(mkReq({ host: "127.0.0.1:3001" })), null);
  // Host 指向外部 → 擋下
  assert.notEqual(checkOrigin(mkReq({ host: "evil.com" })), null);
  // 完全沒有任何可辨識標頭 → 擋下
  assert.notEqual(checkOrigin(mkReq({})), null);
});

test("isPathAllowed 放行 root 與其子目錄", async () => {
  const sub = join(root, "my-project");
  await mkdir(sub);
  assert.equal(isPathAllowed(root), true);
  assert.equal(isPathAllowed(sub), true);
});

test("isPathAllowed 擋掉空字串、../ 逃逸與前綴混淆", () => {
  assert.equal(isPathAllowed(""), false);
  // ../ 逃逸
  assert.equal(isPathAllowed(join(root, "..", "elsewhere")), false);
  // 前綴混淆：<root>-evil 不是 root 的子目錄
  assert.equal(isPathAllowed(root + "-evil"), false);
});

test("isPathAllowed 用 realpath 擋掉指向外部的 symlink", async () => {
  const outside = await mkdtemp(join(tmpdir(), "outside-"));
  const link = join(root, "escape-link");
  await symlink(outside, link);
  try {
    // 字串前綴通過（link 在 root 內），但 realpath 解析後落在 root 外 → 應擋下
    assert.equal(isPathAllowed(link), false);
  } finally {
    await rm(outside, { recursive: true, force: true });
  }
});

test.after(async () => {
  await rm(root, { recursive: true, force: true });
});
