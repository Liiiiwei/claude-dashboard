import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "child_process";
import { scanProjects } from "@/lib/scanner";
import { checkOrigin } from "@/lib/api-guard";

export async function POST(request: NextRequest) {
  const denied = checkOrigin(request);
  if (denied) return denied;

  const { message } = await request.json();

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "請輸入 commit 訊息" }, { status: 400 });
  }

  try {
    const projects = await scanProjects();
    const dirtyProjects = projects.filter((p) => p.git && p.git.dirty > 0);

    if (dirtyProjects.length === 0) {
      return NextResponse.json({ committed: 0, results: [] });
    }

    const results: { name: string; success: boolean; error?: string }[] = [];

    for (const project of dirtyProjects) {
      try {
        // 用 spawnSync 避免 shell 跳脫問題
        const add = spawnSync("git", ["add", "-A"], {
          cwd: project.path,
          timeout: 5000,
          encoding: "utf-8",
        });
        if (add.status !== 0) {
          results.push({
            name: project.name,
            success: false,
            error: add.stderr || "git add 失敗",
          });
          continue;
        }

        const commit = spawnSync("git", ["commit", "-m", message.trim()], {
          cwd: project.path,
          timeout: 10000,
          encoding: "utf-8",
        });
        if (commit.status !== 0) {
          results.push({
            name: project.name,
            success: false,
            error: commit.stderr || "git commit 失敗",
          });
          continue;
        }

        results.push({ name: project.name, success: true });
      } catch (err) {
        results.push({
          name: project.name,
          success: false,
          error: err instanceof Error ? err.message : "提交失敗",
        });
      }
    }

    const committed = results.filter((r) => r.success).length;
    return NextResponse.json({ committed, results });
  } catch (error) {
    console.error("批次提交失敗:", error);
    return NextResponse.json({ error: "批次提交失敗" }, { status: 500 });
  }
}
