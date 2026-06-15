import { NextRequest, NextResponse } from "next/server";
import { resolve } from "path";
import { SCAN_DIR } from "./paths";

// 同源防護：state-changing API 只接受來自本機 dashboard 的請求。
// 惡意網頁透過 CSRF fetch 過來時，瀏覽器會帶上它自己的 Origin → 被擋下。
// 同源請求（或無 Origin 的情況）放行。回傳 NextResponse 代表「已拒絕」。
export function checkOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    const host = new URL(origin).hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return null;
    }
  } catch {
    /* 無法解析的 Origin 視為不合法 */
  }
  return NextResponse.json({ error: "跨來源請求被拒絕" }, { status: 403 });
}

// 路徑防護：限制可操作的路徑必須落在 SCAN_DIR 之內，
// 避免被誘導對任意磁碟路徑執行 open / 啟動 server。
export function isPathAllowed(path: string): boolean {
  if (!path || typeof path !== "string") return false;
  const root = resolve(SCAN_DIR);
  const target = resolve(path);
  return target === root || target.startsWith(root + "/");
}
