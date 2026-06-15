import { NextRequest, NextResponse } from "next/server";
import { execFileSync } from "child_process";
import { access, readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { checkOrigin, isPathAllowed } from "@/lib/api-guard";

const CMUX_BIN = "/Applications/cmux.app/Contents/Resources/bin/cmux";
const CMUX_PASSWORD_FILE = join(homedir(), ".cmux-password");

// 讀 socket password；無檔案就回空字串（後續呼叫會失敗並提示）
async function readCmuxPassword(): Promise<string> {
  try {
    return (await readFile(CMUX_PASSWORD_FILE, "utf8")).trim();
  } catch {
    return "";
  }
}

// 組 cmux 參數，自動帶 --password
function cmuxArgs(password: string, subcommand: string[]): string[] {
  return password ? ["--password", password, ...subcommand] : subcommand;
}

// 等 cmux daemon 起來（最長 10 秒）
async function waitForCmux(password: string): Promise<boolean> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      execFileSync(CMUX_BIN, cmuxArgs(password, ["ping"]), { stdio: "ignore" });
      return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

export async function POST(request: NextRequest) {
  const denied = checkOrigin(request);
  if (denied) return denied;

  const { path, action } = await request.json();

  // 限制只能操作掃描目錄內的路徑，避免被誘導對任意路徑執行 open
  if (!isPathAllowed(path)) {
    return NextResponse.json({ error: "路徑不在允許範圍內" }, { status: 400 });
  }

  try {
    await access(path);
  } catch {
    return NextResponse.json({ error: "路徑不存在" }, { status: 400 });
  }

  if (action !== "finder" && action !== "cmux") {
    return NextResponse.json({ error: "不支援的操作" }, { status: 400 });
  }

  try {
    if (action === "finder") {
      execFileSync("open", [path]);
      return NextResponse.json({ success: true });
    }

    // action === "cmux": 在 cmux 開新 workspace 並自動執行 claude
    const password = await readCmuxPassword();
    if (!password) {
      return NextResponse.json(
        { error: "缺少 cmux 密碼，請建立 ~/.cmux-password" },
        { status: 500 },
      );
    }

    const subcmd = [
      "new-workspace",
      "--cwd",
      path,
      "--command",
      "claude --dangerously-skip-permissions",
    ];
    try {
      const out = execFileSync(CMUX_BIN, cmuxArgs(password, subcmd), {
        encoding: "utf8",
      });
      console.log("[cmux] new-workspace OK:", out.trim());
    } catch (e) {
      const err = e as { stderr?: Buffer; message?: string };
      console.error(
        "[cmux] 第一次失敗，嘗試啟動 cmux app：",
        err.stderr?.toString().trim() || err.message,
      );
      // cmux 沒在跑 → 啟動 app，等 daemon 就緒後重試
      execFileSync("open", ["-a", "cmux"]);
      const ready = await waitForCmux(password);
      if (!ready) {
        return NextResponse.json({ error: "cmux 啟動逾時" }, { status: 500 });
      }
      const out2 = execFileSync(CMUX_BIN, cmuxArgs(password, subcmd), {
        encoding: "utf8",
      });
      console.log("[cmux] retry OK:", out2.trim());
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const err = error as { stderr?: Buffer; message?: string };
    console.error("[cmux] 開啟失敗:", err.message, err.stderr?.toString());
    return NextResponse.json({ error: "開啟失敗" }, { status: 500 });
  }
}
