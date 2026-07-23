import { apiClient } from "./client";
import type { Project } from "../types/api";

export function listProjects() {
  return apiClient.get<Project[]>("/api/projects").then((r) => r.data);
}

export function createProject(projectName: string) {
  return apiClient
    .post<Project>("/api/projects", { project_name: projectName })
    .then((r) => r.data);
}

export function getProject(projectId: number) {
  return apiClient.get<Project>(`/api/projects/${projectId}`).then((r) => r.data);
}
