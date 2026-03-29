"use client";

import { useState } from "react";
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
}

export default function KanbanBoard({ projects, onStatusChange }: Props) {
  const [draggedProject, setDraggedProject] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ProjectStatus | null>(null);

  const handleDragStart = (projectName: string) => {
    setDraggedProject(projectName);
  };

  const handleDragOver = (e: React.DragEvent, status: ProjectStatus) => {
    e.preventDefault();
    setDropTarget(status);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = (e: React.DragEvent, status: ProjectStatus) => {
    e.preventDefault();
    setDropTarget(null);
    if (draggedProject) {
      const project = projects.find((p) => p.name === draggedProject);
      if (project && project.status !== status) {
        onStatusChange(draggedProject, status);
      }
    }
    setDraggedProject(null);
  };

  const handleDragEnd = () => {
    setDraggedProject(null);
    setDropTarget(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {COLUMNS.map(({ status, color }) => {
        const columnProjects = projects.filter((p) => p.status === status);
        const isOver = dropTarget === status;

        return (
          <div
            key={status}
            onDragOver={(e) => handleDragOver(e, status)}
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
                columnProjects.map((project) => (
                  <div
                    key={project.path}
                    draggable
                    onDragStart={() => handleDragStart(project.name)}
                    onDragEnd={handleDragEnd}
                    className={`cursor-grab active:cursor-grabbing transition-opacity ${
                      draggedProject === project.name ? "opacity-50" : ""
                    }`}
                  >
                    <ProjectCard project={project} />
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
