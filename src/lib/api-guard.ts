import { NextRequest, NextResponse } from "next/server";
import { resolve } from "path";
import { realpathSync } from "fs";
import { SCAN_DIR } from "./paths";

// 同源防護：state-changing API 只接受來自本機 dashboard 的請求。
//
// 改採「白名單」策略（原本對無 Origin 一律放行等於門戶大開）：
//   1. 有 Origin → 必須是 localhost / 127.0.0.1 / ::1，否則拒絕（擋惡意網頁 CSRF）。
//   2. 無 Origin（本機瀏覽器同源 fetch 常不帶 Origin）→ 要求 Sec-Fetch-Site
//      為 same-origin / same-site / none，或 Host 為 localhost 才放行。
//      跨站的瀏覽器請求 Sec-Fetch-Site 會是 cross-site，被擋下。
// 回傳 NextResponse 代表「已拒絕」；回傳 null 代表放行。
export function checkOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");

  if (origin) {
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

  // 無 Origin：改用 Sec-Fetch-Site 判斷（現代瀏覽器一律帶此標頭且無法被跨站腳本偽造）。
  // same-origin / same-site = 本機前端；none = 使用者直接輸入網址／書籤。cross-site 一律擋。
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (
    secFetchSite === "same-origin" ||
    secFetchSite === "same-site" ||
    secFetchSite === "none"
  ) {
    return null;
  }

  // 沒有 Sec-Fetch-Site（非瀏覽器客戶端，如 curl／腳本）：僅在 Host 指向本機時放行。
  if (secFetchSite === null) {
    const host = request.headers.get("host") ?? "";
    const hostname = host.split(":")[0];
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]"
    ) {
      return null;
    }
  }

  return NextResponse.json({ error: "跨來源請求被拒絕" }, { status: 403 });
}

// 路徑防護：限制可操作的路徑必須落在 SCAN_DIR 之內，
// 避免被誘導對任意磁碟路徑執行 open / 啟動 server。
// 先做字串前綴比對，再用 realpath 解析 symlink，擋掉「掃描目錄內 symlink 指向外部」的逃逸。
export function isPathAllowed(path: string): boolean {
  if (!path || typeof path !== "string") return false;
  const root = resolve(SCAN_DIR);
  const target = resolve(path);

  const withinRoot = (p: string) => p === root || p.startsWith(root + "/");

  // 第一層：字串比對（擋 ../ 逃逸與前綴混淆，如 "<root>-evil"）
  if (!withinRoot(target)) return false;

  // 第二層：realpath 解析 symlink，確認實體路徑仍在 root 內。
  // 目標可能尚未存在（例如即將建立），realpath 失敗時退回第一層結果即可。
  try {
    const realRoot = realpathSync(root);
    const realTarget = realpathSync(target);
    return realTarget === realRoot || realTarget.startsWith(realRoot + "/");
  } catch {
    return true;
  }
}
