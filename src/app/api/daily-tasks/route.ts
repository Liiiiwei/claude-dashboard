import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { DailyTask, TaskStatus } from "@/lib/types";

const TASKS_PATH = join(process.cwd(), "daily-tasks.json");

async function readTasks(): Promise<DailyTask[]> {
  try {
    const content = await readFile(TASKS_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeTasks(tasks: DailyTask[]): Promise<void> {
  await writeFile(TASKS_PATH, JSON.stringify(tasks, null, 2), "utf-8");
}

// 取得所有任務
export async function GET() {
  const tasks = await readTasks();
  return NextResponse.json(tasks);
}

// 新增任務
export async function POST(request: NextRequest) {
  const { text } = await request.json();
  if (!text?.trim()) {
    return NextResponse.json({ error: "請輸入任務內容" }, { status: 400 });
  }

  const tasks = await readTasks();
  const newTask: DailyTask = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: text.trim(),
    status: "待辦",
    createdAt: new Date().toISOString(),
  };
  tasks.push(newTask);
  await writeTasks(tasks);
  return NextResponse.json(newTask);
}

// 更新任務（移動狀態或排序）
export async function PUT(request: NextRequest) {
  const { id, status, tasks: reorderedTasks } = await request.json();

  // 批次排序更新
  if (reorderedTasks) {
    await writeTasks(reorderedTasks);
    return NextResponse.json({ success: true });
  }

  // 單一任務狀態更新
  const validStatuses: TaskStatus[] = ["待辦", "進行中", "已完成"];
  if (!id || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "無效的參數" }, { status: 400 });
  }

  const tasks = await readTasks();
  const task = tasks.find((t) => t.id === id);
  if (!task) {
    return NextResponse.json({ error: "找不到任務" }, { status: 404 });
  }
  task.status = status;
  await writeTasks(tasks);
  return NextResponse.json(task);
}

// 刪除任務
export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "缺少任務 ID" }, { status: 400 });
  }

  const tasks = await readTasks();
  const filtered = tasks.filter((t) => t.id !== id);
  await writeTasks(filtered);
  return NextResponse.json({ success: true });
}
