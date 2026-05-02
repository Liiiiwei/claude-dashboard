import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { ProjectStatus } from "./types";

interface ProjectConfigEntry {
  status: ProjectStatus;
  note?: string;
  group?: string;
  priority?: number; // 欄位內排序，數字越小越前面
  pinned?: boolean;
}

interface SettingsEntry {
  excludePatterns?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ProjectsConfig {
  [key: string]: any;
}

function asProject(entry: unknown): ProjectConfigEntry {
  return (entry || {}) as ProjectConfigEntry;
}

const CONFIG_PATH = join(process.cwd(), "projects-config.json");

// Module-level 快取，避免每次操作都讀磁碟
let configCache: ProjectsConfig | null = null;

export async function readConfig(): Promise<ProjectsConfig> {
  // 有快取直接回傳，不再讀磁碟
  if (configCache !== null) {
    return configCache;
  }
  try {
    const content = await readFile(CONFIG_PATH, "utf-8");
    configCache = JSON.parse(content);
    return configCache!;
  } catch {
    configCache = {};
    return configCache;
  }
}

export async function writeConfig(config: ProjectsConfig): Promise<void> {
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  // 寫入後同步更新快取，保持一致性
  configCache = config;
}

export async function setProjectStatus(
  name: string,
  status: ProjectStatus,
): Promise<void> {
  const config = await readConfig();
  config[name] = { ...config[name], status };
  await writeConfig(config);
}

export async function setProjectNote(
  name: string,
  note: string,
): Promise<void> {
  const config = await readConfig();
  config[name] = {
    ...config[name],
    status: config[name]?.status || "待辦",
    note,
  };
  await writeConfig(config);
}

export async function setProjectGroup(
  name: string,
  group: string,
): Promise<void> {
  const config = await readConfig();
  config[name] = {
    ...config[name],
    status: config[name]?.status || "待辦",
    group,
  };
  await writeConfig(config);
}

export async function setProjectPriority(
  name: string,
  priority: number,
): Promise<void> {
  const config = await readConfig();
  config[name] = {
    ...config[name],
    status: config[name]?.status || "待辦",
    priority,
  };
  await writeConfig(config);
}

export async function batchUpdatePriority(
  updates: { name: string; priority: number }[],
): Promise<void> {
  const config = await readConfig();
  for (const { name, priority } of updates) {
    config[name] = {
      ...config[name],
      status: config[name]?.status || "待辦",
      priority,
    };
  }
  await writeConfig(config);
}

export async function setProjectPinned(
  name: string,
  pinned: boolean,
): Promise<void> {
  const config = await readConfig();
  config[name] = {
    ...config[name],
    status: (config[name] as ProjectConfigEntry)?.status || "待辦",
    pinned,
  };
  await writeConfig(config);
}

// 排除 pattern 管理（存在 _settings key 下）
export async function getExcludePatterns(): Promise<string[]> {
  const config = await readConfig();
  const settings = config._settings as SettingsEntry | undefined;
  return settings?.excludePatterns || [];
}

export async function addExcludePattern(pattern: string): Promise<void> {
  const config = await readConfig();
  const settings = (config._settings as SettingsEntry) || {};
  const patterns = settings.excludePatterns || [];
  if (!patterns.includes(pattern)) {
    patterns.push(pattern);
  }
  config._settings = { ...settings, excludePatterns: patterns };
  await writeConfig(config);
}

export async function removeExcludePattern(pattern: string): Promise<void> {
  const config = await readConfig();
  const settings = (config._settings as SettingsEntry) || {};
  const patterns = (settings.excludePatterns || []).filter(
    (p) => p !== pattern,
  );
  config._settings = { ...settings, excludePatterns: patterns };
  await writeConfig(config);
}
