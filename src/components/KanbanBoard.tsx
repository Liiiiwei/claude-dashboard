"use client";

import { useState, useRef } from "react";
import type { Project, ProjectStatus } from "@/lib/types";
import ProjectCard from "./ProjectCard";

const COLUMNS: { status: ProjectStatus; color: string }[] = [
  { status: "待辦", color: "border-gray-500" },
  { status: "進行中", color: "border-blue-500" },
  { status: "已完成", color: "border-green-500" },
  { status: "暫停", color: "border-yellow-500" },
];

interface Props {
  projects: Project[];
  onStatusChange: (name: string, status: ProjectStatus) => void;
  onUpdate?: () => void;
  allGroups?: string[];
}

export default function KanbanBoard({ projects, onStatusChange, onUpdate, allGroups }: Props) {
  const [draggedProject, setDraggedProject] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ProjectStatus | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragOverCardRef = useRef<string | null>(null);

  const handleDragStart = (projectName: string) => {
    setDraggedProject(projectName);
  };

  const handleDragOverColumn = (e: React.DragEvent, status: ProjectStatus) => {
    e.preventDefault();
    setDropTarget(status);
  };

  const handleDragOverCard = (e: React.DragEvent, status: ProjectStatus, index: number, projectName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(status);
    if (dragOverCardRef.current !== projectName) {
      dragOverCardRef.current = projectName;
      setDropIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDropTarget(null);
    setDropIndex(null);
    dragOverCardRef.current = null;
  };

  const handleDrop = async (e: React.DragEvent, status: ProjectStatus) => {
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

      const fromIdx = columnProjects.findIndex((p) => p.name === draggedProject);
      if (fromIdx === -1 || fromIdx === dropIndex) {
        setDraggedProject(null);
        return;
      }

      const reordered = [...columnProjects];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(dropIndex, 0, moved);

      // 更新優先級
      const updates = reordered.map((p, i) => ({ name: p.name, priority: i }));
      try {
        await fetch("/api/projects", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "_batch", field: "priority", value: updates }),
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
  };

  const handleDragEnd = () => {
    setDraggedProject(null);
    setDropTarget(null);
    setDropIndex(null);
    dragOverCardRef.current = null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {COLUMNS.map(({ status, color }) => {
        const columnProjects = projects
          .filter((p) => p.status === status)
          .sort((a, b) => a.priority - b.priority);
        const isOver = dropTarget === status;

        return (
          <div
            key={status}
            onDragOver={(e) => handleDragOverColumn(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
            className={`border-t-2 ${color} rounded-lg p-4 min-h-[200px] transition-colors ${
              isOver ? "bg-gray-800/80" : "bg-gray-900/50"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{status}</h3>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                {columnProjects.length}
              </span>
            </div>
            <div className="space-y-4">
              {columnProjects.length === 0 ? (
                <p className={`text-sm text-center py-10 transition-colors ${
                  isOver ? "text-gray-300" : "text-gray-500"
                }`}>
                  {isOver ? "放開以移動到這裡" : "沒有專案"}
                </p>
              ) : (
                columnProjects.map((project, index) => (
                  <div
                    key={project.path}
                    draggable
                    onDragStart={() => handleDragStart(project.name)}
                    onDragOver={(e) => handleDragOverCard(e, status, index, project.name)}
                    onDragEnd={handleDragEnd}
                    className={`cursor-grab active:cursor-grabbing transition-all ${
                      draggedProject === project.name ? "opacity-50 scale-95" : ""
                    } ${
                      isOver && dropIndex === index && draggedProject !== project.name
                        ? "border-t-2 border-blue-400 pt-1"
                        : ""
                    }`}
                  >
                    <ProjectCard project={project} onUpdate={onUpdate} allGroups={allGroups} />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
