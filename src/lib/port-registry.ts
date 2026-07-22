import { readFile, stat } from "fs/promises";
import { join } from "path";
import { writeJsonAtomic, withLock } from "./json-store";

// 序列化所有 registry 寫入，避免並發自動分配時兩個專案搶到同一個 port
const LOCK_KEY = "port-registry";

// Port Registry 的資料結構
interface PortRegistry {
  assignments: Record<string, number>; // projectPath -> port
  portRange: { min: number; max: number };
  autoAssign: boolean;
}

// 預設寫在專案根目錄；可用 PORT_REGISTRY_PATH 覆寫（測試用隔離檔案，避免動到正式資料）
const REGISTRY_PATH =
  process.env.PORT_REGISTRY_PATH || join(process.cwd(), "port-registry.json");

// 模組級快取，避免重複讀取檔案。以 mtime 判斷失效，
// 讓使用者手動編輯 port-registry.json 後 running server 也能讀到新值。
let registryCache: PortRegistry | null = null;
let registryCacheMtime = -1;

// 預設值，當檔案不存在時使用
const DEFAULT_REGISTRY: PortRegistry = {
  assignments: {},
  portRange: { min: 3010, max: 3099 },
  autoAssign: true,
};

// 讀取 registry，有快取機制（以 mtime 判斷是否需重讀）
async function readRegistry(): Promise<PortRegistry> {
  try {
    const { mtimeMs } = await stat(REGISTRY_PATH);
    if (registryCache !== null && mtimeMs === registryCacheMtime) {
      return registryCache;
    }
    const content = await readFile(REGISTRY_PATH, "utf-8");
    registryCache = JSON.parse(content) as PortRegistry;
    registryCacheMtime = mtimeMs;
    return registryCache;
  } catch {
    // 檔案不存在或讀取失敗：沿用既有快取，否則回預設值
    if (registryCache !== null) return registryCache;
    registryCache = { ...DEFAULT_REGISTRY, assignments: {} };
    return registryCache;
  }
}

// 寫入 registry 並同步更新快取（原子寫入，避免半截壞檔）
async function writeRegistry(registry: PortRegistry): Promise<void> {
  await writeJsonAtomic(REGISTRY_PATH, registry);
  // 存深拷貝，避免呼叫端後續 mutate 傳入物件時污染快取
  registryCache = structuredClone(registry);
  try {
    registryCacheMtime = (await stat(REGISTRY_PATH)).mtimeMs;
  } catch {
    registryCacheMtime = -1;
  }
}

// 取得專案的固定 port；若尚未分配且 autoAssign=true，自動分配下一個可用 port
export async function getAssignedPort(projectPath: string): Promise<number> {
  return withLock(LOCK_KEY, async () => {
    const registry = await readRegistry();

    // 已有分配，直接回傳
    if (registry.assignments[projectPath] !== undefined) {
      return registry.assignments[projectPath];
    }

    // 未開啟自動分配，拋出錯誤
    if (!registry.autoAssign) {
      throw new Error(`專案 ${projectPath} 尚未分配 port，且自動分配已關閉`);
    }

    // 找出目前已使用的 port 集合
    const usedPorts = new Set(Object.values(registry.assignments));
    const { min, max } = registry.portRange;

    // 從範圍內找下一個未被使用的 port
    for (let port = min; port <= max; port++) {
      if (!usedPorts.has(port)) {
        registry.assignments[projectPath] = port;
        await writeRegistry(registry);
        return port;
      }
    }

    throw new Error(`port 範圍 ${min}-${max} 已全部用完`);
  });
}

// 手動指定專案的 port
export async function setAssignedPort(
  projectPath: string,
  port: number,
): Promise<void> {
  await withLock(LOCK_KEY, async () => {
    const registry = await readRegistry();
    registry.assignments[projectPath] = port;
    await writeRegistry(registry);
  });
}

// 移除專案的 port 分配
export async function removeAssignment(projectPath: string): Promise<void> {
  await withLock(LOCK_KEY, async () => {
    const registry = await readRegistry();
    delete registry.assignments[projectPath];
    await writeRegistry(registry);
  });
}

// 回傳全部分配表
export async function getAllAssignments(): Promise<Record<string, number>> {
  const registry = await readRegistry();
  return { ...registry.assignments };
}

// 回傳 port 範圍設定
export async function getPortRange(): Promise<{ min: number; max: number }> {
  const registry = await readRegistry();
  return { ...registry.portRange };
}
