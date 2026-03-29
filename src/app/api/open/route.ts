import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { access } from "fs/promises";

export async function POST(request: NextRequest) {
  const { path, action } = await request.json();

  try {
    await access(path);
  } catch {
    return NextResponse.json({ error: "路徑不存在" }, { status: 400 });
  }

  if (action !== "finder" && action !== "vscode") {
    return NextResponse.json({ error: "不支援的操作" }, { status: 400 });
  }

  try {
    if (action === "finder") {
      execSync(`open "${path}"`);
    } else {
      execSync(`code "${path}"`);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("開啟失敗:", error);
    return NextResponse.json({ error: "開啟失敗" }, { status: 500 });
  }
}
