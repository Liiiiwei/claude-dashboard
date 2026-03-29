import { NextResponse } from "next/server";
import { scanProjects } from "@/lib/scanner";

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
