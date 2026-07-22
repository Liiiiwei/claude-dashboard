import { NextRequest, NextResponse } from "next/server";
import { spawn, spawnSync } from "child_process";
import { access } from "fs/promises";
import net from "net";
import { detectServerForPath } from "@/lib/process-detect";
import { getAssignedPort } from "@/lib/port-registry";
import { checkOrigin, isPathAllowed } from "@/lib/api-guard";

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

// 嘗試連上指定 port，確認 server 真的開始監聽
function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(1000);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

// 輪詢等待 server 真正就緒（最多 timeoutMs），避免回報「假性啟動成功」
async function waitForServerReady(
  port: number,
  timeoutMs = 20_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await canConnect(port)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

// 用 lsof 找出佔用指定 port 的 PID 並終止
// 用 spawnSync 直接執行 lsof、不經 shell，port 以陣列參數傳入，杜絕指令注入
function killProcessOnPort(port: number): void {
  // 防呆：只接受合法 port 數字，避免污染值流入（呼叫端理應已驗，這裡再守一層）
  if (!Number.isInteger(port) || port < 1 || port > 65535) return;
  try {
    const result = spawnSync("lsof", ["-iTCP:" + port, "-sTCP:LISTEN", "-t"], {
      encoding: "utf-8",
      timeout: 5000,
    });
    const output = result.stdout || "";
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
  const denied = checkOrigin(request);
  if (denied) return denied;

  const { path, action } = await request.json();

  // 限制只能操作掃描目錄內的路徑，避免被誘導對任意路徑啟動 process
  if (!isPathAllowed(path)) {
    return NextResponse.json({ error: "路徑不在允許範圍內" }, { status: 400 });
  }

  try {
    await access(path);
  } catch {
    return NextResponse.json({ error: "路徑不存在" }, { status: 400 });
  }

  if (action === "start") {
    // 先用系統偵測檢查是否已在執行
    const existing = await detectServerForPath(path);
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

      // -H 127.0.0.1：強制被啟動的子專案 dev server 也只綁本機，不對區網開放
      const child = spawn(
        "npm",
        ["run", "dev", "--", "-p", String(port), "-H", "127.0.0.1"],
        {
          cwd: path,
          detached: true,
          stdio: "ignore",
        },
      );
      child.unref();

      if (child.pid) {
        // 輪詢直到 server 真的能連上，而非固定等 2 秒就回報成功
        const ready = await waitForServerReady(port);
        if (!ready) {
          // 逾時前先收掉剛 spawn 的 child process group，避免留下佔 port 的殭屍 dev server
          try {
            process.kill(-child.pid, "SIGTERM");
          } catch {
            try {
              process.kill(child.pid, "SIGTERM");
            } catch {
              // process 可能已結束
            }
          }
          return NextResponse.json(
            {
              error: "啟動逾時，server 未在時間內開始監聽",
              pid: child.pid,
              port,
            },
            { status: 504 },
          );
        }
        return NextResponse.json({ running: true, port, pid: child.pid });
      }
      return NextResponse.json({ error: "啟動失敗" }, { status: 500 });
    } catch (error) {
      console.error("啟動 dev server 失敗:", error);
      return NextResponse.json({ error: "啟動失敗" }, { status: 500 });
    }
  }

  if (action === "stop") {
    const server = await detectServerForPath(path);
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
    const server = await detectServerForPath(path);
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
