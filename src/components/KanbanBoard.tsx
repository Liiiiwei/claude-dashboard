"use client";

import React, { useMemo, useState, useRef, useCallback } from "react";
import type { Project, ProjectStatus } from "@/lib/types";
import ProjectCard from "./ProjectCard";

interface ColumnTheme {
  dot: string; // 圓點背景色
  text: string; // 標題文字色
  badge: string; // 計數徽章背景
  tint: string; // 欄位整體淡色底
  overTint: string; // hover 時的色底
}

const COLUMNS: { status: ProjectStatus; theme: ColumnTheme }[] = [
  {
    status: "待辦",
    theme: {
      dot: "bg-gray-400",
      text: "text-gray-600",
      badge: "bg-gray-100/70 text-gray-600",
      tint: "bg-gray-50/40",
      overTint: "bg-gray-100/60",
    },
  },
  {
    status: "進行中",
    theme: {
      dot: "bg-blue-400",
      text: "text-blue-700",
      badge: "bg-blue-100/70 text-blue-700",
      tint: "bg-blue-50/40",
      overTint: "bg-blue-100/50",
    },
  },
  {
    status: "已完成",
    theme: {
      dot: "bg-green-400",
      text: "text-green-700",
      badge: "bg-green-100/70 text-green-700",
      tint: "bg-green-50/40",
      overTint: "bg-green-100/50",
    },
  },
  {
    status: "暫停",
    theme: {
      dot: "bg-amber-400",
      text: "text-amber-700",
      badge: "bg-amber-100/70 text-amber-700",
      tint: "bg-amber-50/40",
      overTint: "bg-amber-100/50",
    },
  },
];

interface KanbanColumnProps {
  status: ProjectStatus;
  theme: ColumnTheme;
  projects: Project[];
  isOver: boolean;
  dropIndex: number | null;
  draggedProject: string | null;
  allGroups?: string[];
  runningPorts: Record<string, number>;
  degraded?: boolean;
  onUpdate?: () => void;
  onDevServerStarted: (projectPath: string, port: number) => void;
  onStatusChange: (name: string, status: ProjectStatus) => void;
  onDragStart: (projectName: string) => void;
  onDragOverColumn: (e: React.DragEvent, status: ProjectStatus) => void;
  onDragOverCard: (
    e: React.DragEvent,
    status: ProjectStatus,
    index: number,
    projectName: string,
  ) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: ProjectStatus) => void;
  onDragEnd: () => void;
}

// 獨立的欄位元件，用 React.memo 避免其他欄位更新時重繪
const KanbanColumn = React.memo(function KanbanColumn({
  status,
  theme,
  projects,
  isOver,
  dropIndex,
  draggedProject,
  allGroups,
  runningPorts,
  degraded,
  onUpdate,
  onDevServerStarted,
  onStatusChange,
  onDragStart,
  onDragOverColumn,
  onDragOverCard,
  onDragLeave,
  onDrop,
  onDragEnd,
}: KanbanColumnProps) {
  return (
    <div
      onDragOver={(e) => onDragOverColumn(e, status)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, status)}
      // P2-8：毛玻璃收斂在欄位這一層（整個看板僅 4 層合成），卡片本身不再各自 blur
      className={`rounded-xl p-3 min-h-[200px] transition-colors backdrop-blur-md ${
        isOver ? theme.overTint : theme.tint
      }`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
          <h3 className={`font-semibold text-sm ${theme.text}`}>{status}</h3>
        </div>
        <span
          className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${theme.badge}`}
        >
          {projects.length}
        </span>
      </div>
      <ul className="space-y-2.5 list-none m-0 p-0" role="list">
        {projects.length === 0 ? (
          <li
            className={`text-xs text-center py-8 transition-colors ${
              isOver ? "text-gray-600" : "text-gray-500"
            }`}
          >
            {isOver ? "放開以移動到這裡" : "沒有專案"}
          </li>
        ) : (
          projects.map((project, index) => (
            <li
              key={project.path}
              role="listitem"
              draggable
              onDragStart={(e) => {
                // Firefox 要求 dragstart 期間必須 setData，否則不會進入拖移狀態
                e.dataTransfer.setData("text/plain", project.name);
                e.dataTransfer.effectAllowed = "move";
                onDragStart(project.name);
              }}
              onDragOver={(e) => onDragOverCard(e, status, index, project.name)}
              onDragEnd={onDragEnd}
              className={`cursor-grab active:cursor-grabbing transition-all ${
                draggedProject === project.name ? "opacity-50 scale-95" : ""
              } ${
                isOver && dropIndex === index && draggedProject !== project.name
                  ? "ring-2 ring-blue-400/50 rounded-xl"
                  : ""
              }`}
            >
              <ProjectCard
                project={project}
                onUpdate={onUpdate}
                allGroups={allGroups}
                runningPort={runningPorts[project.path] ?? null}
                degraded={degraded}
                onDevServerStarted={onDevServerStarted}
                onStatusChange={onStatusChange}
              />
            </li>
          ))
        )}
      </ul>
    </div>
  );
});

interface Props {
  projects: Project[];
  onStatusChange: (name: string, status: ProjectStatus) => void;
  onUpdate?: () => void;
  allGroups?: string[];
  runningPorts: Record<string, number>;
  degraded?: boolean;
  onDevServerStarted: (projectPath: string, port: number) => void;
}

export default function KanbanBoard({
  projects,
  onStatusChange,
  onUpdate,
  allGroups,
  runningPorts,
  degraded,
  onDevServerStarted,
}: Props) {
  const [draggedProject, setDraggedProject] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ProjectStatus | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragOverCardRef = useRef<string | null>(null);

  // 依狀態分組並排序一次，讓 KanbanColumn 的 React.memo 能真正生效
  const columns = useMemo(() => {
    const map = new Map<ProjectStatus, Project[]>(
      COLUMNS.map(({ status }) => [status, []]),
    );
    for (const p of projects) map.get(p.status)?.push(p);
    for (const list of map.values())
      list.sort((a, b) => a.priority - b.priority);
    return map;
  }, [projects]);

  const handleDragStart = useCallback((projectName: string) => {
    setDraggedProject(projectName);
  }, []);

  const handleDragOverColumn = useCallback(
    (e: React.DragEvent, status: ProjectStatus) => {
      e.preventDefault();
      setDropTarget(status);
    },
    [],
  );

  const handleDragOverCard = useCallback(
    (
      e: React.DragEvent,
      status: ProjectStatus,
      index: number,
      projectName: string,
    ) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(status);
      if (dragOverCardRef.current !== projectName) {
        dragOverCardRef.current = projectName;
        setDropIndex(index);
      }
    },
    [],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // 游標移入子卡片時 dragleave 也會冒泡到欄位，用 relatedTarget 判斷是否真的離開
    if (
      e.relatedTarget instanceof Node &&
      e.currentTarget.contains(e.relatedTarget)
    ) {
      return;
    }
    setDropTarget(null);
    setDropIndex(null);
    dragOverCardRef.current = null;
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, status: ProjectStatus) => {
      e.preventDefault();
      setDropTarget(null);
      setDropIndex(null);
      dragOverCardRef.current = null;

      if (!draggedProject) return;

      const project = projects.find((p) => p.name === draggedProject);
      if (!project) return;

      const sameColumn = project.status === status;

      if (sameColumn && dropIndex !== null) {
        // 同欄位內排序
        const columnProjects = projects
          .filter((p) => p.status === status)
          .sort((a, b) => a.priority - b.priority);

        const fromIdx = columnProjects.findIndex(
          (p) => p.name === draggedProject,
        );
        if (fromIdx === -1 || fromIdx === dropIndex) {
          setDraggedProject(null);
          return;
        }

        const reordered = [...columnProjects];
        const [moved] = reordered.splice(fromIdx, 1);
        reordered.splice(dropIndex, 0, moved);

        // 更新優先級
        const updates = reordered.map((p, i) => ({
          name: p.name,
          priority: i,
        }));
        try {
          await fetch("/api/projects", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "_batch",
              field: "priority",
              value: updates,
            }),
          });
          onUpdate?.();
        } catch {
          // 靜默失敗
        }
      } else if (!sameColumn) {
        // 跨欄位移動
        onStatusChange(draggedProject, status);
      }

      setDraggedProject(null);
    },
    [draggedProject, dropIndex, projects, onStatusChange, onUpdate],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedProject(null);
    setDropTarget(null);
    setDropIndex(null);
    dragOverCardRef.current = null;
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {COLUMNS.map(({ status, theme }) => {
        const columnProjects = columns.get(status)!;
        const isOver = dropTarget === status;

        return (
          <KanbanColumn
            key={status}
            status={status}
            theme={theme}
            projects={columnProjects}
            isOver={isOver}
            dropIndex={isOver ? dropIndex : null}
            draggedProject={draggedProject}
            allGroups={allGroups}
            runningPorts={runningPorts}
            degraded={degraded}
            onUpdate={onUpdate}
            onDevServerStarted={onDevServerStarted}
            onStatusChange={onStatusChange}
            onDragStart={handleDragStart}
            onDragOverColumn={handleDragOverColumn}
            onDragOverCard={handleDragOverCard}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        );
      })}
    </div>
  );
}
