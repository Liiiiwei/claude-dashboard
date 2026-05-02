import { NextRequest, NextResponse } from "next/server";
import { scanProjects } from "@/lib/scanner";
import { setProjectStatus } from "@/lib/config";
import type { Project, ProjectStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

// Module-level 快取，TTL 30 秒，避免短時間內重複掃描磁碟
interface ProjectsCache {
  data: Project[];
  expiresAt: number;
}

let cache: ProjectsCache | null = null;
const CACHE_TTL_MS = 30_000;

function invalidateCache() {
  cache = null;
}

async function getCachedProjects(): Promise<Project[]> {
  const now = Date.now();
  if (cache && now < cache.expiresAt) {
    return cache.data;
  }
  // 快取失效或不存在，重新掃描
  const data = await scanProjects();
  cache = { data, expiresAt: now + CACHE_TTL_MS };
  return data;
}

export async function GET() {
  try {
    const projects = await getCachedProjects();
    return NextResponse.json(projects);
  } catch (error) {
    console.error("掃描專案失敗:", error);
    return NextResponse.json({ error: "掃描專案失敗" }, { status: 500 });
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
    // 狀態更新後讓快取失效，下次 GET 會重新掃描
    invalidateCache();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("更新狀態失敗:", error);
    return NextResponse.json({ error: "更新狀態失敗" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { name, field, value } = await request.json();

  if (!name || !field) {
    return NextResponse.json({ error: "無效的參數" }, { status: 400 });
  }

  try {
    if (field === "note") {
      const { setProjectNote } = await import("@/lib/config");
      await setProjectNote(name, value || "");
    } else if (field === "group") {
      const { setProjectGroup } = await import("@/lib/config");
      await setProjectGroup(name, value || "");
    } else if (field === "priority") {
      // 批次更新排序：value 是 { name: string; priority: number }[]
      const { batchUpdatePriority } = await import("@/lib/config");
      await batchUpdatePriority(value);
    } else if (field === "pinned") {
      const { setProjectPinned } = await import("@/lib/config");
      await setProjectPinned(name, !!value);
    } else if (field === "exclude") {
      const { addExcludePattern } = await import("@/lib/config");
      await addExcludePattern(value);
    } else if (field === "unexclude") {
      const { removeExcludePattern } = await import("@/lib/config");
      await removeExcludePattern(value);
    } else if (field === "excludePatterns") {
      const { getExcludePatterns } = await import("@/lib/config");
      const patterns = await getExcludePatterns();
      return NextResponse.json({ patterns });
    } else {
      return NextResponse.json({ error: "不支援的欄位" }, { status: 400 });
    }
    // 輕量 PATCH 操作後讓快取失效，避免回傳舊資料
    invalidateCache();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("更新失敗:", error);
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }
}
