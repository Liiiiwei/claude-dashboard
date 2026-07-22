import { NextRequest, NextResponse } from "next/server";
import { checkOrigin } from "@/lib/api-guard";

export async function POST(request: NextRequest) {
  // 加上同源防護，避免被當成匿名的 GitHub API 轉發器
  const denied = checkOrigin(request);
  if (denied) return denied;

  let url: unknown;
  try {
    ({ url } = await request.json());
  } catch {
    return NextResponse.json({ visibility: "unknown" });
  }

  if (typeof url !== "string") {
    return NextResponse.json({ visibility: "unknown" });
  }

  // 錨定 github.com 開頭並擷取 owner/repo，擋掉 evil.com/github.com、github.com.evil.com 等繞過
  const match = url.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+)/);
  if (!match) {
    return NextResponse.json({ visibility: "unknown" });
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${match[1]}`, {
      headers: { "User-Agent": "project-dashboard" },
      // 加逾時，避免慢速回應長時間佔用連線
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 200) {
      const data = await res.json();
      return NextResponse.json({
        visibility: data.private ? "private" : "public",
      });
    } else if (res.status === 404) {
      // 404 可能是私有 repo（沒有 auth token）
      return NextResponse.json({ visibility: "private" });
    }
    return NextResponse.json({ visibility: "unknown" });
  } catch {
    return NextResponse.json({ visibility: "unknown" });
  }
}
