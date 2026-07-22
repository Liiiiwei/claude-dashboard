import { NextRequest, NextResponse } from "next/server";
import { scanProjects } from "@/lib/scanner";
import { setProjectStatus } from "@/lib/config";
import { detectListeningServers } from "@/lib/process-detect";
import { checkOrigin } from "@/lib/api-guard";
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

// 將即時偵測到的 dev server 對應回各專案（runningPort 屬易變狀態，不進快取）
// 回傳 degraded：偵測層失敗時為 true，讓前端把「未執行」與「偵測不可用」分開顯示
async function withRunningState(
  projects: Project[],
): Promise<{ projects: Project[]; degraded: boolean }> {
  const { servers, degraded } = await detectListeningServers();
  const pathToPort = new Map<string, number>();
  for (const s of servers) {
    if (s.cwd) pathToPort.set(s.cwd, s.port);
  }
  return {
    projects: projects.map((p) => ({
      ...p,
      // 偵測不可用時 runningPort 設 null，但由 degraded 告知前端這不代表「確定未執行」
      runningPort: pathToPort.get(p.path) ?? null,
    })),
    degraded,
  };
}

export async function GET() {
  try {
    const projects = await getCachedProjects();
    const { projects: withState, degraded } = await withRunningState(projects);
    return NextResponse.json({ projects: withState, degraded });
  } catch (error) {
    console.error("掃描專案失敗:", error);
    return NextResponse.json({ error: "掃描專案失敗" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const denied = checkOrigin(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "無效的請求內容" }, { status: 400 });
  }
  const { name, status } = (body ?? {}) as { name?: unknown; status?: unknown };

  const validStatuses: ProjectStatus[] = ["待辦", "進行中", "已完成", "暫停"];
  if (
    typeof name !== "string" ||
    !validStatuses.includes(status as ProjectStatus)
  ) {
    return NextResponse.json({ error: "無效的參數" }, { status: 400 });
  }

  try {
    await setProjectStatus(name, status as ProjectStatus);
    // 狀態更新後讓快取失效，下次 GET 會重新掃描
    invalidateCache();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("更新狀態失敗:", error);
    return NextResponse.json({ error: "更新狀態失敗" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = checkOrigin(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "無效的請求內容" }, { status: 400 });
  }
  const { name, field, value } = (body ?? {}) as {
    name?: unknown;
    field?: unknown;
    value?: unknown;
  };

  // 欄位白名單：只接受已知欄位，擋掉未預期的寫入路徑
  const ALLOWED_FIELDS = [
    "note",
    "group",
    "priority",
    "pinned",
    "pinOrder",
    "exclude",
    "unexclude",
    "excludePatterns",
  ] as const;

  // name 必須是字串，且不可為保留 key（_settings）或原型污染鍵（__proto__ 等）
  if (
    typeof name !== "string" ||
    name === "" ||
    name === "_settings" ||
    name.startsWith("__")
  ) {
    return NextResponse.json({ error: "無效的參數" }, { status: 400 });
  }
  if (
    typeof field !== "string" ||
    !ALLOWED_FIELDS.includes(field as (typeof ALLOWED_FIELDS)[number])
  ) {
    return NextResponse.json({ error: "不支援的欄位" }, { status: 400 });
  }
  // 批次欄位的 value 必須是陣列，否則後續 for...of 會在執行期炸成 500
  if ((field === "priority" || field === "pinOrder") && !Array.isArray(value)) {
    return NextResponse.json({ error: "無效的參數" }, { status: 400 });
  }

  try {
    if (field === "note") {
      const { setProjectNote } = await import("@/lib/config");
      await setProjectNote(name, (value as string) || "");
    } else if (field === "group") {
      const { setProjectGroup } = await import("@/lib/config");
      await setProjectGroup(name, (value as string) || "");
    } else if (field === "priority") {
      // 批次更新排序：value 是 { name: string; priority: number }[]（已驗證為陣列）
      const { batchUpdatePriority } = await import("@/lib/config");
      await batchUpdatePriority(value as { name: string; priority: number }[]);
    } else if (field === "pinned") {
      const { setProjectPinned } = await import("@/lib/config");
      await setProjectPinned(name, !!value);
    } else if (field === "pinOrder") {
      // 批次更新釘選列順序：value 是 { name: string; pinOrder: number }[]（已驗證為陣列）
      const { batchUpdatePinOrder } = await import("@/lib/config");
      await batchUpdatePinOrder(value as { name: string; pinOrder: number }[]);
    } else if (field === "exclude") {
      const { addExcludePattern } = await import("@/lib/config");
      await addExcludePattern(value as string);
    } else if (field === "unexclude") {
      const { removeExcludePattern } = await import("@/lib/config");
      await removeExcludePattern(value as string);
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
