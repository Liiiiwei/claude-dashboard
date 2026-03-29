import { NextRequest, NextResponse } from "next/server";
import { scanProjects } from "@/lib/scanner";
import { setProjectStatus } from "@/lib/config";
import type { ProjectStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await scanProjects();
    return NextResponse.json(projects);
  } catch (error) {
    console.error("掃描專案失敗:", error);
    return NextResponse.json(
      { error: "掃描專案失敗" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const { name, status } = await request.json();

  const validStatuses: ProjectStatus[] = ["待辦", "進行中", "已完成", "暫停"];
  if (!name || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "無效的參數" }, { status: 400 });
  }

  try {
    await setProjectStatus(name, status);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("更新狀態失敗:", error);
    return NextResponse.json({ error: "更新狀態失敗" }, { status: 500 });
  }
}
