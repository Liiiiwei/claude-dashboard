import { readdir, stat, readFile, access } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import type { Project } from "./types";
import { readConfig, getExcludePatterns } from "./config";
import { SCAN_DIR } from "./paths";

// 將 exec 包裝成 Promise，避免阻塞 event loop
const execAsync = promisify(exec);

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
        await readFile(join(projectPath, "package.json"), "utf-8"),
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
        await readFile(join(projectPath, "manifest.json"), "utf-8"),
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
      f !== "tsconfig.json",
  );
  for (const jsonFile of jsonFiles) {
    try {
      const content = JSON.parse(
        await readFile(join(projectPath, jsonFile), "utf-8"),
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

// 非同步取得最後 commit 訊息，避免阻塞
async function getLastCommit(projectPath: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync('git log -1 --format="%s"', {
      cwd: projectPath,
      timeout: 3000,
    });
    return stdout.trim().replace(/^"|"$/g, "") || null;
  } catch {
    return null;
  }
}

// 非同步取得 git branch、dirty 檔案數、remote URL、commit 總數，避免阻塞
async function getGitInfo(projectPath: string): Promise<{
  branch: string;
  dirty: number;
  remoteUrl: string | null;
  totalCommits: number | null;
} | null> {
  try {
    const [branchResult, statusResult, remoteResult, commitCountResult] =
      await Promise.all([
        execAsync("git rev-parse --abbrev-ref HEAD", {
          cwd: projectPath,
          timeout: 3000,
        }),
        execAsync("git status --porcelain", {
          cwd: projectPath,
          timeout: 3000,
        }),
        execAsync("git remote get-url origin", {
          cwd: projectPath,
          timeout: 3000,
        }).catch(() => ({ stdout: "" })),
        execAsync("git rev-list --count HEAD", {
          cwd: projectPath,
          timeout: 3000,
        }).catch(() => ({ stdout: "" })),
      ]);

    const branch = branchResult.stdout.trim();
    const dirty = statusResult.stdout.trim()
      ? statusResult.stdout.trim().split("\n").length
      : 0;
    const remoteUrl = remoteResult.stdout.trim() || null;
    const totalCommits = commitCountResult.stdout.trim()
      ? parseInt(commitCountResult.stdout.trim(), 10)
      : null;

    return { branch, dirty, remoteUrl, totalCommits };
  } catch {
    return null;
  }
}

async function checkDevScript(projectPath: string): Promise<boolean> {
  try {
    const pkg = JSON.parse(
      await readFile(join(projectPath, "package.json"), "utf-8"),
    );
    return !!pkg.scripts?.dev;
  } catch {
    return false;
  }
}

async function readPackageInfo(
  projectPath: string,
): Promise<{ scripts: string[]; depsCount: number | null }> {
  try {
    const pkg = JSON.parse(
      await readFile(join(projectPath, "package.json"), "utf-8"),
    );
    const scripts = pkg.scripts ? Object.keys(pkg.scripts) : [];
    const deps = Object.keys(pkg.dependencies || {}).length;
    const devDeps = Object.keys(pkg.devDependencies || {}).length;
    return { scripts, depsCount: deps + devDeps };
  } catch {
    return { scripts: [], depsCount: null };
  }
}

function matchesPattern(name: string, pattern: string): boolean {
  if (pattern.includes("*")) {
    const regex = new RegExp(
      "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
    );
    return regex.test(name);
  }
  return name === pattern;
}

export async function scanProjects(): Promise<Project[]> {
  const entries = await readdir(SCAN_DIR, { withFileTypes: true });
  const config = await readConfig();
  const excludePatterns = await getExcludePatterns();

  // 排除符合 pattern 的資料夾
  const filtered = entries.filter(
    (entry) =>
      entry.isDirectory() &&
      !excludePatterns.some((p) => matchesPattern(entry.name, p)),
  );

  // 所有專案並行處理，避免序列等待
  const projects = await Promise.all(
    filtered.map(async (entry) => {
      const projectPath = join(SCAN_DIR, entry.name);
      const projectStat = await stat(projectPath);

      const [tags, description, hasDevScript, pkgInfo] = await Promise.all([
        detectTags(projectPath),
        readDescription(projectPath),
        checkDevScript(projectPath),
        readPackageInfo(projectPath),
      ]);

      // git 資訊也並行取得
      const [gitInfo, lastCommit] = await Promise.all([
        tags.includes("Git") ? getGitInfo(projectPath) : Promise.resolve(null),
        tags.includes("Git")
          ? getLastCommit(projectPath)
          : Promise.resolve(null),
      ]);

      return {
        name: entry.name,
        description,
        path: projectPath,
        tags,
        lastModified: projectStat.mtime.toISOString(),
        lastCommit,
        status: config[entry.name]?.status || "待辦",
        note: config[entry.name]?.note || "",
        group: config[entry.name]?.group || "",
        git: gitInfo,
        hasDevScript,
        priority: config[entry.name]?.priority ?? 999,
        pinned: !!config[entry.name]?.pinned,
        pinOrder: config[entry.name]?.pinOrder ?? 999,
        scripts: pkgInfo.scripts,
        depsCount: pkgInfo.depsCount,
        runningPort: null, // 由 API 層合併即時偵測結果填入
      } satisfies Project;
    }),
  );

  projects.sort(
    (a, b) =>
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
  );

  return projects;
}
