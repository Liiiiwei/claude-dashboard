import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { ProjectStatus } from "./types";

interface ProjectConfigEntry {
  status: ProjectStatus;
  note?: string;
  group?: string;
  priority?: number; // 欄位內排序，數字越小越前面
}

interface ProjectsConfig {
  [projectName: string]: ProjectConfigEntry;
}

const CONFIG_PATH = join(process.cwd(), "projects-config.json");

export async function readConfig(): Promise<ProjectsConfig> {
  try {
    const content = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export async function writeConfig(config: ProjectsConfig): Promise<void> {
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export async function setProjectStatus(name: string, status: ProjectStatus): Promise<void> {
  const config = await readConfig();
  config[name] = { ...config[name], status };
  await writeConfig(config);
}

export async function setProjectNote(name: string, note: string): Promise<void> {
  const config = await readConfig();
  config[name] = { ...config[name], status: config[name]?.status || "待辦", note };
  await writeConfig(config);
}

export async function setProjectGroup(name: string, group: string): Promise<void> {
  const config = await readConfig();
  config[name] = { ...config[name], status: config[name]?.status || "待辦", group };
  await writeConfig(config);
}

export async function setProjectPriority(name: string, priority: number): Promise<void> {
  const config = await readConfig();
  config[name] = { ...config[name], status: config[name]?.status || "待辦", priority };
  await writeConfig(config);
}

export async function batchUpdatePriority(updates: { name: string; priority: number }[]): Promise<void> {
  const config = await readConfig();
  for (const { name, priority } of updates) {
    config[name] = { ...config[name], status: config[name]?.status || "待辦", priority };
  }
  await writeConfig(config);
}
