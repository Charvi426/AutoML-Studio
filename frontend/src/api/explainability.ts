import { apiClient } from "./client";
import type { ShapSummary, ShapInstanceExplanation } from "../types/api";

export function getShapSummary(
  projectId: number,
  datasetId: number,
  runId: number,
  modelName: string,
) {
  return apiClient
    .get<ShapSummary>(
      `/api/projects/${projectId}/datasets/${datasetId}/training-runs/${runId}/models/${modelName}/explain/summary`,
    )
    .then((r) => r.data);
}

export function getShapInstance(
  projectId: number,
  datasetId: number,
  runId: number,
  modelName: string,
  rowIndex: number,
) {
  return apiClient
    .get<ShapInstanceExplanation>(
      `/api/projects/${projectId}/datasets/${datasetId}/training-runs/${runId}/models/${modelName}/explain/instance/${rowIndex}`,
    )
    .then((r) => r.data);
}
