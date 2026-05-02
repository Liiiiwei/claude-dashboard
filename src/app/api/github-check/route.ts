import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url || !url.includes("github.com")) {
    return NextResponse.json({ visibility: "unknown" });
  }

  // 從 URL 取得 owner/repo
  const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
  if (!match) {
    return NextResponse.json({ visibility: "unknown" });
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${match[1]}`, {
      headers: { "User-Agent": "project-dashboard" },
    });

    if (res.status === 200) {
      const data = await res.json();
      return NextResponse.json({ visibility: data.private ? "private" : "public" });
    } else if (res.status === 404) {
      // 404 可能是私有 repo（沒有 auth token）
      return NextResponse.json({ visibility: "private" });
    }
    return NextResponse.json({ visibility: "unknown" });
  } catch {
    return NextResponse.json({ visibility: "unknown" });
  }
}
