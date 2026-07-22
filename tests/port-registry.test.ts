import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { register } from "node:module";

// 註冊 .ts 副檔名解析 hook，讓原始碼的 extensionless 相對匯入能被 Node 解析
register("./ts-ext-resolve.mjs", import.meta.url);

// 用隔離的暫存檔當 registry，避免動到專案根目錄的 port-registry.json
const dir = await mkdtemp(join(tmpdir(), "port-registry-"));
const registryFile = join(dir, "port-registry.json");
process.env.PORT_REGISTRY_PATH = registryFile;
const { getAssignedPort } = await import("../src/lib/port-registry.ts");

// 寫入指定的 registry 內容並小睡，確保 mtime 前進讓模組快取失效重讀
async function seedRegistry(reg: {
  assignments: Record<string, number>;
  portRange: { min: number; max: number };
  autoAssign: boolean;
}) {
  await writeFile(registryFile, JSON.stringify(reg));
  await new Promise((r) => setTimeout(r, 15));
}

test("併發自動分配：多個專案不會搶到同一個 port", async () => {
  await seedRegistry({
    assignments: {},
    portRange: { min: 3010, max: 3099 },
    autoAssign: true,
  });

  const paths = Array.from({ length: 10 }, (_, i) => `/proj/app-${i}`);
  const ports = await Promise.all(paths.map((p) => getAssignedPort(p)));

  const unique = new Set(ports);
  assert.equal(unique.size, ports.length, "每個專案應拿到不同的 port");
  for (const port of ports) {
    assert.ok(port >= 3010 && port <= 3099, `port ${port} 應落在範圍內`);
  }
});

test("範圍用盡時拋錯", async () => {
  await seedRegistry({
    assignments: {},
    portRange: { min: 3010, max: 3011 }, // 只有兩個 port
    autoAssign: true,
  });

  await getAssignedPort("/proj/a"); // 3010
  await getAssignedPort("/proj/b"); // 3011
  await assert.rejects(
    () => getAssignedPort("/proj/c"),
    /已全部用完/,
    "第三個專案應因範圍用盡而拋錯",
  );
});

test("autoAssign 關閉且未分配時拋錯", async () => {
  await seedRegistry({
    assignments: {},
    portRange: { min: 3010, max: 3099 },
    autoAssign: false,
  });

  await assert.rejects(
    () => getAssignedPort("/proj/never-assigned"),
    /自動分配已關閉/,
    "未分配且 autoAssign=false 應拋錯",
  );
});

test("已分配的專案直接回傳既有 port（不重新分配）", async () => {
  await seedRegistry({
    assignments: { "/proj/fixed": 3050 },
    portRange: { min: 3010, max: 3099 },
    autoAssign: true,
  });

  assert.equal(await getAssignedPort("/proj/fixed"), 3050);
});

test.after(async () => {
  await rm(dir, { recursive: true, force: true });
});
