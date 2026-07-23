import { apiClient } from "./client";
import type {
  SavedModelOut,
  PredictionResult,
  PredictionHistoryEntry,
  PredictionStats,
} from "../types/api";

export function getSavedModel(projectId: number) {
  return apiClient
    .get<SavedModelOut>(`/api/projects/${projectId}/saved-model`)
    .then((r) => r.data);
}

export function predictSingle(projectId: number, payload: Record<string, unknown>) {
  return apiClient
    .post<PredictionResult>(`/api/projects/${projectId}/predict`, payload)
    .then((r) => r.data);
}

export function predictBatch(projectId: number, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient
    .post(`/api/projects/${projectId}/predict/batch`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      responseType: "blob",
    })
    .then((r) => r.data as Blob);
}

export function getPredictionHistory(projectId: number) {
  return apiClient
    .get<PredictionHistoryEntry[]>(`/api/projects/${projectId}/predictions/history`)
    .then((r) => r.data);
}

export function getPredictionStats(projectId: number) {
  return apiClient
    .get<PredictionStats>(`/api/projects/${projectId}/predictions/stats`)
    .then((r) => r.data);
}
