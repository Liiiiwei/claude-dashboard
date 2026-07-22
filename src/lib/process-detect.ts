import { exec } from "child_process";
import { promisify } from "util";
import net from "net";

// 將 exec 包裝成 Promise，避免同步呼叫阻塞 Next.js 的單執行緒 event loop
const execAsync = promisify(exec);

export interface RunningServer {
  pid: number;
  port: number;
  cwd: string | null;
  cpu: number;
  mem: number;
}

// 偵測結果：servers 為監聽中的 server 清單；
// degraded 代表偵測本身失敗（lsof 逾時／錯誤），用來區分
// 「掃過了，真的沒 server」與「偵測不可用」，避免 UI 把後者誤報成「未執行」。
export interface DetectResult {
  servers: RunningServer[];
  degraded: boolean;
}

// 短 TTL 記憶體快取：/api/projects 與 /api/processes 常在同一秒被輪詢，
// 沒有快取會重複 fork lsof。TTL 設 2 秒，兼顧即時性與成本。
const CACHE_TTL_MS = 2000;
let detectCache: { result: DetectResult; expiresAt: number } | null = null;

// 用 lsof 找出所有監聽中的 TCP port，再用 ps 取得 cwd 與資源使用
export async function detectListeningServers(): Promise<DetectResult> {
  const now = Date.now();
  if (detectCache && now < detectCache.expiresAt) {
    return detectCache.result;
  }

  try {
    // 找出所有 LISTEN 狀態的 TCP 連線（只看 node 相關）
    const { stdout: lsofOutput } = await execAsync(
      "lsof -iTCP -sTCP:LISTEN -P -n -F pcn 2>/dev/null || true",
      { encoding: "utf-8", timeout: 5000 },
    );

    // 解析 lsof -F 格式：p=PID, c=command, n=name (含 port)
    const servers: Map<number, { pid: number; port: number; command: string }> =
      new Map();
    let currentPid = 0;
    let currentCommand = "";

    for (const line of lsofOutput.split("\n")) {
      if (line.startsWith("p")) {
        currentPid = parseInt(line.slice(1), 10);
      } else if (line.startsWith("c")) {
        currentCommand = line.slice(1);
      } else if (line.startsWith("n")) {
        // 格式: n*:3010 或 n127.0.0.1:3010
        const portMatch = line.match(/:(\d+)$/);
        if (portMatch && currentPid) {
          const port = parseInt(portMatch[1], 10);
          // 只追蹤 3000+ 的 port（dev server 常用範圍）
          if (
            port >= 3000 &&
            port < 9999 &&
            currentCommand.toLowerCase().includes("node")
          ) {
            servers.set(currentPid, {
              pid: currentPid,
              port,
              command: currentCommand,
            });
          }
        }
      }
    }

    if (servers.size === 0) {
      const result: DetectResult = { servers: [], degraded: false };
      detectCache = { result, expiresAt: now + CACHE_TTL_MS };
      return result;
    }

    // 批次取得所有 PID 的 CPU、MEM（一次 ps 呼叫）
    const pids = Array.from(servers.keys());
    const pidList = pids.join(",");

    // cpuMemMap: pid -> { cpu, mem }
    const cpuMemMap = new Map<number, { cpu: number; mem: number }>();
    try {
      const { stdout: psOutput } = await execAsync(
        `ps -o pid=,%cpu=,%mem= -p ${pidList} 2>/dev/null`,
        { encoding: "utf-8", timeout: 5000 },
      );
      for (const line of psOutput.split("\n")) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          const pid = parseInt(parts[0], 10);
          if (!isNaN(pid)) {
            cpuMemMap.set(pid, {
              cpu: parseFloat(parts[1]) || 0,
              mem: parseFloat(parts[2]) || 0,
            });
          }
        }
      }
    } catch {
      /* 靜默：ps 失敗時各值維持 0（非致命，不算 degraded） */
    }

    // 批次取得所有 PID 的 cwd（一次 lsof 呼叫）
    // lsof -Fp -Fn 輸出格式：p<PID>\nn<path>
    const cwdMap = new Map<number, string>();
    try {
      const { stdout: lsofOut } = await execAsync(
        `lsof -d cwd -a -p ${pidList} -Fpn 2>/dev/null`,
        { encoding: "utf-8", timeout: 5000 },
      );
      let cwdPid = 0;
      for (const line of lsofOut.split("\n")) {
        if (line.startsWith("p")) {
          cwdPid = parseInt(line.slice(1), 10);
        } else if (line.startsWith("n/") && cwdPid) {
          // 只取第一個符合的 cwd（每個 PID 只有一個）
          if (!cwdMap.has(cwdPid)) {
            cwdMap.set(cwdPid, line.slice(1));
          }
        }
      }
    } catch {
      /* 靜默：lsof 失敗時 cwd 維持 null（非致命，不算 degraded） */
    }

    // 組合結果
    const list: RunningServer[] = [];
    for (const [pid, server] of servers) {
      const stats = cpuMemMap.get(pid) ?? { cpu: 0, mem: 0 };
      const cwd = cwdMap.get(pid) ?? null;
      list.push({ pid: server.pid, port: server.port, cwd, ...stats });
    }

    const result: DetectResult = { servers: list, degraded: false };
    detectCache = { result, expiresAt: now + CACHE_TTL_MS };
    return result;
  } catch (error) {
    // 主 lsof 掃描失敗：回報 degraded，不快取（下次呼叫重試），並留下可診斷 log
    console.error("偵測監聽 server 失敗:", error);
    return { servers: [], degraded: true };
  }
}

// 偵測特定路徑是否有正在跑的 dev server
export async function detectServerForPath(
  projectPath: string,
): Promise<RunningServer | null> {
  const { servers } = await detectListeningServers();
  return (
    servers.find(
      (s) =>
        s.cwd !== null &&
        (s.cwd === projectPath || s.cwd.startsWith(projectPath + "/")),
    ) || null
  );
}

// 檢查 port 是否可用
export function findAvailablePort(startPort: number = 3010): Promise<number> {
  return new Promise((resolve) => {
    const tryPort = (port: number) => {
      const server = net.createServer();
      server.once("error", () => tryPort(port + 1));
      server.once("listening", () => {
        server.close(() => resolve(port));
      });
      server.listen(port, "127.0.0.1");
    };
    tryPort(startPort);
  });
}
