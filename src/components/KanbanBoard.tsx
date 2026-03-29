"use client";

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
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {COLUMNS.map(({ status, color }) => {
        const columnProjects = projects.filter((p) => p.status === status);
        return (
          <div key={status} className={`border-t-2 ${color} bg-gray-900/50 rounded-lg p-3`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">{status}</h3>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                {columnProjects.length}
              </span>
            </div>
            <div className="space-y-3">
              {columnProjects.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-8">沒有專案</p>
              ) : (
                columnProjects.map((project) => (
                  <div key={project.path}>
                    <ProjectCard project={project} />
                    <select
                      value={project.status}
                      onChange={(e) => onStatusChange(project.name, e.target.value as ProjectStatus)}
                      className="mt-1 w-full bg-gray-800 text-gray-400 text-xs rounded px-2 py-1 border border-gray-700"
                    >
                      <option value="待辦">待辦</option>
                      <option value="進行中">進行中</option>
                      <option value="已完成">已完成</option>
                      <option value="暫停">暫停</option>
                    </select>
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
