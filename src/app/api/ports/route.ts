import { NextRequest, NextResponse } from "next/server";
import { basename } from "path";
import { detectListeningServers } from "@/lib/process-detect";
import {
  getAllAssignments,
  setAssignedPort,
  removeAssignment,
} from "@/lib/port-registry";

export const dynamic = "force-dynamic";

const SCAN_DIR =
  process.env.SCAN_DIR ||
  (process.env.HOME || "") + "/Desktop/vibe-coding playground";

// 從 cwd 解析專案名稱
function resolveProjectName(cwd: string | null): string | null {
  if (!cwd) return null;
  const scanPrefix = SCAN_DIR.endsWith("/") ? SCAN_DIR : SCAN_DIR + "/";
  if (cwd.startsWith(scanPrefix)) {
    const relative = cwd.slice(scanPrefix.length);
    return relative.split("/")[0] || null;
  }
  return basename(cwd);
}

// GET: 合併即時偵測的 process 與 registry 分配表
export async function GET() {
  try {
    const [servers, registry] = await Promise.all([
      Promise.resolve(detectListeningServers()),
      getAllAssignments(),
    ]);

    // 建立 port -> projectPath 的反查表
    const portToPath = new Map<number, string>();
    for (const [path, port] of Object.entries(registry)) {
      portToPath.set(port as number, path);
    }

    const ports = servers.map((s) => {
      const projectName = resolveProjectName(s.cwd);
      const assigned = portToPath.has(s.port);

      return {
        pid: s.pid,
        port: s.port,
        projectName,
        projectPath: s.cwd,
        cpu: s.cpu,
        mem: s.mem,
        assigned,
      };
    });

    return NextResponse.json({ ports, registry });
  } catch (error) {
    console.error("取得 port 資訊失敗:", error);
    return NextResponse.json({ error: "取得 port 資訊失敗" }, { status: 500 });
  }
}

// POST: kill / killAll / assign / unassign
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "kill") {
      const { pid } = body as { action: string; pid: number };
      if (!pid || typeof pid !== "number") {
        return NextResponse.json({ error: "缺少有效的 pid" }, { status: 400 });
      }
      try {
        process.kill(-pid, "SIGTERM");
      } catch {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
          // process 可能已結束
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "killAll") {
      const servers = detectListeningServers();
      for (const s of servers) {
        try {
          process.kill(-s.pid, "SIGTERM");
        } catch {
          try {
            process.kill(s.pid, "SIGTERM");
          } catch {
            // 靜默處理
          }
        }
      }
      return NextResponse.json({ ok: true, killed: servers.length });
    }

    if (action === "assign") {
      const { projectPath, port } = body as {
        action: string;
        projectPath: string;
        port: number;
      };
      if (!projectPath || !port) {
        return NextResponse.json(
          { error: "缺少 projectPath 或 port" },
          { status: 400 },
        );
      }
      await setAssignedPort(projectPath, port);
      return NextResponse.json({ ok: true });
    }

    if (action === "unassign") {
      const { projectPath } = body as { action: string; projectPath: string };
      if (!projectPath) {
        return NextResponse.json(
          { error: "缺少 projectPath" },
          { status: 400 },
        );
      }
      await removeAssignment(projectPath);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "不支援的操作" }, { status: 400 });
  } catch (error) {
    console.error("Port 操作失敗:", error);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
