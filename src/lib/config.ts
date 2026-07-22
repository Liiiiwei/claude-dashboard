import { readFile, stat } from "fs/promises";
import { join } from "path";
import type { ProjectStatus } from "./types";
import { writeJsonAtomic, withLock } from "./json-store";

// 序列化所有 config 寫入，避免並發的「讀-改-寫」互相覆蓋
const LOCK_KEY = "projects-config";

interface ProjectConfigEntry {
  status: ProjectStatus;
  note?: string;
  group?: string;
  priority?: number; // 欄位內排序，數字越小越前面
  pinned?: boolean;
  pinOrder?: number; // 釘選列順序，數字越小越前面
}

interface SettingsEntry {
  excludePatterns?: string[];
}

// 具型別的設定結構：一般 key 是專案設定，_settings 為保留 key 存排除清單
type ProjectsConfig = Record<string, ProjectConfigEntry | undefined> & {
  _settings?: SettingsEntry;
};

const CONFIG_PATH = join(process.cwd(), "projects-config.json");

// Module-level 快取，避免每次操作都讀磁碟。
// 以檔案 mtime 判斷失效，讓使用者手動編輯 projects-config.json 後 running server 也能讀到新值。
let configCache: ProjectsConfig | null = null;
let configCacheMtime = -1;

export async function readConfig(): Promise<ProjectsConfig> {
  try {
    const { mtimeMs } = await stat(CONFIG_PATH);
    // 快取存在且檔案未被改動 → 直接回傳快取
    if (configCache !== null && mtimeMs === configCacheMtime) {
      return configCache;
    }
    const content = await readFile(CONFIG_PATH, "utf-8");
    configCache = JSON.parse(content) as ProjectsConfig;
    configCacheMtime = mtimeMs;
    return configCache;
  } catch {
    // 檔案不存在或讀取失敗：沿用既有快取，否則回空設定
    if (configCache !== null) return configCache;
    configCache = {};
    return configCache;
  }
}

export async function writeConfig(config: ProjectsConfig): Promise<void> {
  await writeJsonAtomic(CONFIG_PATH, config);
  // 存深拷貝，避免呼叫端後續 mutate 傳入物件時污染快取
  configCache = structuredClone(config);
  try {
    configCacheMtime = (await stat(CONFIG_PATH)).mtimeMs;
  } catch {
    configCacheMtime = -1;
  }
}

export async function setProjectStatus(
  name: string,
  status: ProjectStatus,
): Promise<void> {
  await withLock(LOCK_KEY, async () => {
    const config = await readConfig();
    config[name] = { ...config[name], status };
    await writeConfig(config);
  });
}

export async function setProjectNote(
  name: string,
  note: string,
): Promise<void> {
  await withLock(LOCK_KEY, async () => {
    const config = await readConfig();
    config[name] = {
      ...config[name],
      status: config[name]?.status || "待辦",
      note,
    };
    await writeConfig(config);
  });
}

export async function setProjectGroup(
  name: string,
  group: string,
): Promise<void> {
  await withLock(LOCK_KEY, async () => {
    const config = await readConfig();
    config[name] = {
      ...config[name],
      status: config[name]?.status || "待辦",
      group,
    };
    await writeConfig(config);
  });
}

export async function setProjectPriority(
  name: string,
  priority: number,
): Promise<void> {
  await withLock(LOCK_KEY, async () => {
    const config = await readConfig();
    config[name] = {
      ...config[name],
      status: config[name]?.status || "待辦",
      priority,
    };
    await writeConfig(config);
  });
}

export async function batchUpdatePriority(
  updates: { name: string; priority: number }[],
): Promise<void> {
  await withLock(LOCK_KEY, async () => {
    const config = await readConfig();
    for (const { name, priority } of updates) {
      config[name] = {
        ...config[name],
        status: config[name]?.status || "待辦",
        priority,
      };
    }
    await writeConfig(config);
  });
}

export async function setProjectPinned(
  name: string,
  pinned: boolean,
): Promise<void> {
  await withLock(LOCK_KEY, async () => {
    const config = await readConfig();
    config[name] = {
      ...config[name],
      status: config[name]?.status || "待辦",
      pinned,
    };
    await writeConfig(config);
  });
}

export async function batchUpdatePinOrder(
  updates: { name: string; pinOrder: number }[],
): Promise<void> {
  await withLock(LOCK_KEY, async () => {
    const config = await readConfig();
    for (const { name, pinOrder } of updates) {
      config[name] = {
        ...config[name],
        status: config[name]?.status || "待辦",
        pinOrder,
      };
    }
    await writeConfig(config);
  });
}

// 排除 pattern 管理（存在 _settings key 下）
export async function getExcludePatterns(): Promise<string[]> {
  const config = await readConfig();
  const settings = config._settings as SettingsEntry | undefined;
  return settings?.excludePatterns || [];
}

export async function addExcludePattern(pattern: string): Promise<void> {
  await withLock(LOCK_KEY, async () => {
    const config = await readConfig();
    const settings = (config._settings as SettingsEntry) || {};
    const patterns = settings.excludePatterns || [];
    if (!patterns.includes(pattern)) {
      patterns.push(pattern);
    }
    config._settings = { ...settings, excludePatterns: patterns };
    await writeConfig(config);
  });
}

export async function removeExcludePattern(pattern: string): Promise<void> {
  await withLock(LOCK_KEY, async () => {
    const config = await readConfig();
    const settings = (config._settings as SettingsEntry) || {};
    const patterns = (settings.excludePatterns || []).filter(
      (p) => p !== pattern,
    );
    config._settings = { ...settings, excludePatterns: patterns };
    await writeConfig(config);
  });
}
