import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { access } from "fs/promises";

// 追蹤執行中的 dev server
const runningServers = new Map<string, { pid: number; port: number }>();

export async function POST(request: NextRequest) {
  const { path, action } = await request.json();

  try {
    await access(path);
  } catch {
    return NextResponse.json({ error: "路徑不存在" }, { status: 400 });
  }

  if (action === "start") {
    // 檢查是否已在執行
    if (runningServers.has(path)) {
      const server = runningServers.get(path)!;
      return NextResponse.json({ running: true, port: server.port, pid: server.pid });
    }

    // 找一個可用的 port（從 3010 開始避免衝突）
    const port = 3010 + runningServers.size;

    try {
      const child = spawn("npm", ["run", "dev", "--", "-p", String(port)], {
        cwd: path,
        detached: true,
        stdio: "ignore",
      });
      child.unref();

      if (child.pid) {
        runningServers.set(path, { pid: child.pid, port });
        return NextResponse.json({ running: true, port, pid: child.pid });
      }
      return NextResponse.json({ error: "啟動失敗" }, { status: 500 });
    } catch (error) {
      console.error("啟動 dev server 失敗:", error);
      return NextResponse.json({ error: "啟動失敗" }, { status: 500 });
    }
  }

  if (action === "stop") {
    const server = runningServers.get(path);
    if (server) {
      try {
        process.kill(-server.pid);
      } catch {
        // 程序可能已結束
      }
      runningServers.delete(path);
    }
    return NextResponse.json({ running: false });
  }

  if (action === "status") {
    const server = runningServers.get(path);
    if (server) {
      try {
        process.kill(server.pid, 0); // 檢查是否還活著
        return NextResponse.json({ running: true, port: server.port, pid: server.pid });
      } catch {
        runningServers.delete(path);
      }
    }
    return NextResponse.json({ running: false });
  }

  return NextResponse.json({ error: "不支援的操作" }, { status: 400 });
}
