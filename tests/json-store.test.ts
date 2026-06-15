import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { writeJsonAtomic, withLock } from "../src/lib/json-store.ts";

// 原子寫入：寫完後檔案內容正確，且不留下任何 .tmp 暫存檔
test("writeJsonAtomic 寫入有效 JSON 且不留暫存檔", async () => {
  const dir = await mkdtemp(join(tmpdir(), "json-store-"));
  try {
    const target = join(dir, "data.json");
    const payload = { a: 1, nested: { b: [1, 2, 3] } };
    await writeJsonAtomic(target, payload);

    const parsed = JSON.parse(await readFile(target, "utf-8"));
    assert.deepEqual(parsed, payload);

    const leftovers = (await readdir(dir)).filter((f) => f.endsWith(".tmp"));
    assert.equal(leftovers.length, 0, "不應殘留 .tmp 暫存檔");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// 序列化：併發的「讀-改-寫」不會互相覆蓋，最終結果等於累加次數
test("withLock 序列化同一 key 的讀-改-寫，不掉資料", async () => {
  let shared = 0;

  // 模擬 read-modify-write：讀出 -> 非同步等待 -> 加一寫回
  const increment = () =>
    withLock("counter", async () => {
      const current = shared;
      await new Promise((r) => setTimeout(r, 5));
      shared = current + 1;
    });

  await Promise.all(Array.from({ length: 50 }, () => increment()));
  assert.equal(shared, 50, "50 次併發累加應全部生效");
});

// 不同 key 之間互不阻塞，但各自仍維持序列
test("withLock 不同 key 互不干擾", async () => {
  const order: string[] = [];
  await Promise.all([
    withLock("a", async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push("a");
    }),
    withLock("b", async () => {
      order.push("b");
    }),
  ]);
  // b 沒有被 a 的等待擋住，應先完成
  assert.deepEqual(order, ["b", "a"]);
});

// 佇列中某次失敗，不應中斷後續操作
test("withLock 單次失敗不影響後續排隊任務", async () => {
  const results: string[] = [];
  const p1 = withLock("q", async () => {
    throw new Error("boom");
  }).catch(() => results.push("p1-rejected"));
  const p2 = withLock("q", async () => {
    results.push("p2-ran");
  });
  await Promise.all([p1, p2]);
  assert.deepEqual(results, ["p1-rejected", "p2-ran"]);
});
