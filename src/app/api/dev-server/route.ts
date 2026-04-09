import { NextRequest, NextResponse } from "next/server";
import { spawn, execSync } from "child_process";
import { access } from "fs/promises";
import net from "net";
import { detectServerForPath } from "@/lib/process-detect";
import { getAssignedPort } from "@/lib/port-registry";

export const dynamic = "force-dynamic";

// 檢查 port 是否可用
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

// 用 lsof 找出佔用指定 port 的 PID 並終止
function killProcessOnPort(port: number): void {
  try {
    const output = execSync(
      `lsof -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null || true`,
      { encoding: "utf-8", timeout: 5000 },
    );
    const pids = output
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    for (const pidStr of pids) {
      const pid = parseInt(pidStr, 10);
      if (!isNaN(pid)) {
        try {
          process.kill(-pid, "SIGTERM");
        } catch {
          try {
            process.kill(pid, "SIGTERM");
          } catch {
            // process 可能已結束
          }
        }
      }
    }
  } catch {
    // lsof 失敗時靜默處理
  }
}

export async function POST(request: NextRequest) {
  const { path, action } = await request.json();

  try {
    await access(path);
  } catch {
    return NextResponse.json({ error: "路徑不存在" }, { status: 400 });
  }

  if (action === "start") {
    // 先用系統偵測檢查是否已在執行
    const existing = detectServerForPath(path);
    if (existing) {
      return NextResponse.json({
        running: true,
        port: existing.port,
        pid: existing.pid,
      });
    }

    try {
      // 從 port registry 取得固定 port（若無分配會自動分配）
      const port = await getAssignedPort(path);

      // 檢查 assigned port 是否被其他 process 佔用
      const available = await isPortAvailable(port);
      if (!available) {
        killProcessOnPort(port);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const child = spawn("npm", ["run", "dev", "--", "-p", String(port)], {
        cwd: path,
        detached: true,
        stdio: "ignore",
      });
      child.unref();

      if (child.pid) {
        // 等待一下讓 server 啟動
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return NextResponse.json({ running: true, port, pid: child.pid });
      }
      return NextResponse.json({ error: "啟動失敗" }, { status: 500 });
    } catch (error) {
      console.error("啟動 dev server 失敗:", error);
      return NextResponse.json({ error: "啟動失敗" }, { status: 500 });
    }
  }

  if (action === "stop") {
    const server = detectServerForPath(path);
    if (server) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        try {
          process.kill(server.pid, "SIGTERM");
        } catch {
          // process 可能已結束
        }
      }
    }
    return NextResponse.json({ running: false });
  }

  if (action === "status") {
    const server = detectServerForPath(path);
    if (server) {
      return NextResponse.json({
        running: true,
        port: server.port,
        pid: server.pid,
      });
    }
    return NextResponse.json({ running: false });
  }

  return NextResponse.json({ error: "不支援的操作" }, { status: 400 });
}
