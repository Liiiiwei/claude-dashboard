import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { ProjectStatus } from "./types";

interface ProjectsConfig {
  [projectName: string]: {
    status: ProjectStatus;
  };
}

// 設定檔放在儀表板專案自己的根目錄
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

export async function getProjectStatus(name: string): Promise<ProjectStatus> {
  const config = await readConfig();
  return config[name]?.status || "待辦";
}

export async function setProjectStatus(name: string, status: ProjectStatus): Promise<void> {
  const config = await readConfig();
  config[name] = { ...config[name], status };
  await writeConfig(config);
}
