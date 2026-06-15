import { NextResponse } from "next/server";
import { detectListeningServers } from "@/lib/process-detect";
import { basename } from "path";
import { SCAN_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const servers = detectListeningServers();

    // 將 cwd 對應到專案名稱（取 SCAN_DIR 後的第一層目錄）
    const scanPrefix = SCAN_DIR.endsWith("/") ? SCAN_DIR : SCAN_DIR + "/";
    const result = servers.map((s) => {
      let projectName: string | null = null;
      if (s.cwd?.startsWith(scanPrefix)) {
        const relative = s.cwd.slice(scanPrefix.length);
        projectName = relative.split("/")[0] || null;
      } else if (s.cwd) {
        projectName = basename(s.cwd);
      }
      return {
        pid: s.pid,
        port: s.port,
        cpu: s.cpu,
        mem: s.mem,
        cwd: s.cwd,
        projectName,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("偵測 process 失敗:", error);
    return NextResponse.json({ error: "偵測失敗" }, { status: 500 });
  }
}
