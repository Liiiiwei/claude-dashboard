import { readdir, stat, readFile, access } from "fs/promises";
import { join } from "path";
import { execSync } from "child_process";
import type { Project } from "./types";

const SCAN_DIR =
  process.env.SCAN_DIR ||
  join(process.env.HOME || "", "Desktop", "vibe-coding playground");

async function detectTags(projectPath: string): Promise<string[]> {
  const tags: string[] = [];

  const exists = async (filename: string) => {
    try {
      await access(join(projectPath, filename));
      return true;
    } catch {
      return false;
    }
  };

  // 檢查 package.json
  if (await exists("package.json")) {
    try {
      const pkg = JSON.parse(
        await readFile(join(projectPath, "package.json"), "utf-8")
      );
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (allDeps["next"]) {
        tags.push("Next.js");
      } else {
        tags.push("Node.js");
      }
    } catch {
      tags.push("Node.js");
    }
  }

  if (await exists("appsscript.json")) {
    tags.push("Apps Script");
  }

  if (await exists("manifest.json")) {
    try {
      const manifest = JSON.parse(
        await readFile(join(projectPath, "manifest.json"), "utf-8")
      );
      if (manifest.manifest_version) {
        tags.push("Chrome 擴充");
      }
    } catch {}
  }

  const files = await readdir(projectPath);
  if (files.some((f) => f.endsWith(".py"))) {
    tags.push("Python");
  }

  if (await exists("Dockerfile")) {
    tags.push("Docker");
  }

  if (await exists(".git")) {
    tags.push("Git");
  }

  // n8n
  const jsonFiles = files.filter(
    (f) =>
      f.endsWith(".json") &&
      f !== "package.json" &&
      f !== "manifest.json" &&
      f !== "appsscript.json" &&
      f !== "tsconfig.json"
  );
  for (const jsonFile of jsonFiles) {
    try {
      const content = JSON.parse(
        await readFile(join(projectPath, jsonFile), "utf-8")
      );
      if (content.nodes && content.connections) {
        tags.push("n8n");
        break;
      }
    } catch {}
  }

  // HTML
  if (tags.length === 0 || (tags.length === 1 && tags[0] === "Git")) {
    if (files.some((f) => f.endsWith(".html"))) {
      tags.push("HTML");
    }
  }

  return tags;
}

async function readDescription(projectPath: string): Promise<string> {
  for (const filename of ["CLAUDE.md", "README.md"]) {
    try {
      const content = await readFile(join(projectPath, filename), "utf-8");
      const lines = content.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        const match = line.match(/^#\s+(.+)/);
        if (match) return match[1].trim();
      }
      if (lines.length > 0) return lines[0].trim();
    } catch {}
  }
  return "";
}

function getLastCommit(projectPath: string): string | null {
  try {
    const result = execSync('git log -1 --format="%s"', {
      cwd: projectPath,
      timeout: 3000,
      encoding: "utf-8",
    });
    return result.trim().replace(/^"|"$/g, "") || null;
  } catch {
    return null;
  }
}

export async function scanProjects(): Promise<Project[]> {
  const entries = await readdir(SCAN_DIR, { withFileTypes: true });
  const projects: Project[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const projectPath = join(SCAN_DIR, entry.name);
    const projectStat = await stat(projectPath);

    const [tags, description] = await Promise.all([
      detectTags(projectPath),
      readDescription(projectPath),
    ]);

    projects.push({
      name: entry.name,
      description,
      path: projectPath,
      tags,
      lastModified: projectStat.mtime.toISOString(),
      lastCommit: tags.includes("Git") ? getLastCommit(projectPath) : null,
    });
  }

  projects.sort(
    (a, b) =>
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
  );

  return projects;
}
