import { apiClient } from "./client";
import type { TrainingRunOut, TrainingRunSummary, SavedModelOut } from "../types/api";

export function trainModels(projectId: number, datasetId: number) {
  return apiClient
    .post<TrainingRunOut>(`/api/projects/${projectId}/datasets/${datasetId}/train`)
    .then((r) => r.data);
}

export function listTrainingRuns(projectId: number, datasetId: number) {
  return apiClient
    .get<TrainingRunSummary[]>(`/api/projects/${projectId}/datasets/${datasetId}/training-runs`)
    .then((r) => r.data);
}

export function getTrainingRun(projectId: number, datasetId: number, runId: number) {
  return apiClient
    .get<TrainingRunOut>(
      `/api/projects/${projectId}/datasets/${datasetId}/training-runs/${runId}`,
    )
    .then((r) => r.data);
}

export function saveModel(
  projectId: number,
  datasetId: number,
  runId: number,
  modelName: string,
) {
  return apiClient
    .post<SavedModelOut>(
      `/api/projects/${projectId}/datasets/${datasetId}/training-runs/${runId}/models/${modelName}/save`,
    )
    .then((r) => r.data);
}
