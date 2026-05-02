"use client";

import React, { useState, useRef, useCallback } from "react";
import type { Project, ProjectStatus } from "@/lib/types";
import ProjectCard from "./ProjectCard";

const COLUMNS: { status: ProjectStatus; color: string }[] = [
  { status: "待辦", color: "border-gray-400" },
  { status: "進行中", color: "border-blue-400" },
  { status: "已完成", color: "border-green-400" },
  { status: "暫停", color: "border-amber-400" },
];

interface KanbanColumnProps {
  status: ProjectStatus;
  color: string;
  projects: Project[];
  isOver: boolean;
  dropIndex: number | null;
  draggedProject: string | null;
  allGroups?: string[];
  runningPorts: Record<string, number>;
  onUpdate?: () => void;
  onDevServerStarted: (projectPath: string, port: number) => void;
  onDragStart: (projectName: string) => void;
  onDragOverColumn: (e: React.DragEvent, status: ProjectStatus) => void;
  onDragOverCard: (
    e: React.DragEvent,
    status: ProjectStatus,
    index: number,
    projectName: string,
  ) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, status: ProjectStatus) => void;
  onDragEnd: () => void;
}

// 獨立的欄位元件，用 React.memo 避免其他欄位更新時重繪
const KanbanColumn = React.memo(function KanbanColumn({
  status,
  color,
  projects,
  isOver,
  dropIndex,
  draggedProject,
  allGroups,
  runningPorts,
  onUpdate,
  onDevServerStarted,
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
      className={`border-t-2 ${color} rounded-2xl p-4 min-h-[200px] transition-colors ${
        isOver ? "bg-white/50 backdrop-blur-md" : "bg-white/20 backdrop-blur-sm"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-700">{status}</h3>
        <span className="text-xs text-gray-500 bg-white/50 px-2 py-0.5 rounded-full border border-white/60">
          {projects.length}
        </span>
      </div>
      <div className="space-y-4">
        {projects.length === 0 ? (
          <p
            className={`text-sm text-center py-10 transition-colors ${
              isOver ? "text-gray-600" : "text-gray-400"
            }`}
          >
            {isOver ? "放開以移動到這裡" : "沒有專案"}
          </p>
        ) : (
          projects.map((project, index) => (
            <div
              key={project.path}
              draggable
              onDragStart={() => onDragStart(project.name)}
              onDragOver={(e) => onDragOverCard(e, status, index, project.name)}
              onDragEnd={onDragEnd}
              className={`cursor-grab active:cursor-grabbing transition-all ${
                draggedProject === project.name ? "opacity-50 scale-95" : ""
              } ${
                isOver && dropIndex === index && draggedProject !== project.name
                  ? "border-t-2 border-blue-400 pt-1"
                  : ""
              }`}
            >
              <ProjectCard
                project={project}
                onUpdate={onUpdate}
                allGroups={allGroups}
                runningPort={runningPorts[project.path] ?? null}
                onDevServerStarted={onDevServerStarted}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
});

interface Props {
  projects: Project[];
  onStatusChange: (name: string, status: ProjectStatus) => void;
  onUpdate?: () => void;
  allGroups?: string[];
  runningPorts: Record<string, number>;
  onDevServerStarted: (projectPath: string, port: number) => void;
}

export default function KanbanBoard({
  projects,
  onStatusChange,
  onUpdate,
  allGroups,
  runningPorts,
  onDevServerStarted,
}: Props) {
  const [draggedProject, setDraggedProject] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ProjectStatus | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragOverCardRef = useRef<string | null>(null);

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

  const handleDragLeave = useCallback(() => {
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {COLUMNS.map(({ status, color }) => {
        const columnProjects = projects
          .filter((p) => p.status === status)
          .sort((a, b) => a.priority - b.priority);
        const isOver = dropTarget === status;

        return (
          <KanbanColumn
            key={status}
            status={status}
            color={color}
            projects={columnProjects}
            isOver={isOver}
            dropIndex={dropIndex}
            draggedProject={draggedProject}
            allGroups={allGroups}
            runningPorts={runningPorts}
            onUpdate={onUpdate}
            onDevServerStarted={onDevServerStarted}
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
