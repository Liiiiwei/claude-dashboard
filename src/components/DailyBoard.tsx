"use client";

import { useState, useEffect, useCallback } from "react";
import type { DailyTask, TaskStatus } from "@/lib/types";

const COLUMNS: { status: TaskStatus; color: string }[] = [
  { status: "待辦", color: "border-gray-500" },
  { status: "進行中", color: "border-blue-500" },
  { status: "已完成", color: "border-green-500" },
];

export default function DailyBoard() {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
  const [adding, setAdding] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/daily-tasks");
      if (res.ok) setTasks(await res.json());
    } catch { /* 靜默 */ }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const addTask = async () => {
    if (!newTaskText.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/daily-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newTaskText.trim() }),
      });
      if (res.ok) {
        const task = await res.json();
        setTasks((prev) => [...prev, task]);
        setNewTaskText("");
      }
    } catch { /* 靜默 */ }
    setAdding(false);
  };

  const moveTask = async (id: string, status: TaskStatus) => {
    // 樂觀更新
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      await fetch("/api/daily-tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
    } catch {
      fetchTasks(); // 回滾
    }
  };

  const deleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await fetch("/api/daily-tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      fetchTasks();
    }
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDropTarget(null);
    if (draggedId) {
      const task = tasks.find((t) => t.id === draggedId);
      if (task && task.status !== status) {
        moveTask(draggedId, status);
      }
    }
    setDraggedId(null);
  };

  return (
    <div>
      {/* 新增任務 */}
      <div className="flex gap-2 mb-5">
        <input
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="新增日常任務..."
          className="flex-1 bg-gray-800 text-gray-200 rounded-lg px-4 py-3 border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
        />
        <button
          onClick={addTask}
          disabled={adding || !newTaskText.trim()}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors text-white"
        >
          新增
        </button>
      </div>

      {/* 看板 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {COLUMNS.map(({ status, color }) => {
          const columnTasks = tasks.filter((t) => t.status === status);
          const isOver = dropTarget === status;

          return (
            <div
              key={status}
              onDragOver={(e) => { e.preventDefault(); setDropTarget(status); }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(e) => handleDrop(e, status)}
              className={`border-t-2 ${color} rounded-lg p-4 min-h-[200px] transition-colors ${
                isOver ? "bg-gray-800/80" : "bg-gray-900/50"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{status}</h3>
                <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                  {columnTasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {columnTasks.length === 0 ? (
                  <p className={`text-sm text-center py-10 transition-colors ${
                    isOver ? "text-gray-300" : "text-gray-500"
                  }`}>
                    {isOver ? "放開以移動到這裡" : "沒有任務"}
                  </p>
                ) : (
                  columnTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => setDraggedId(task.id)}
                      onDragEnd={() => { setDraggedId(null); setDropTarget(null); }}
                      className={`group bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all ${
                        draggedId === task.id ? "opacity-50 scale-95" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-sm break-words ${status === "已完成" ? "line-through text-gray-500" : ""}`}>
                          {task.text}
                        </span>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs shrink-0 transition-opacity"
                          title="刪除"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
