import { apiClient } from "./client";
import type {
  Dataset,
  DatasetUploadResult,
  DatasetProfile,
  TargetSelectionResult,
  PreprocessingReport,
  FeatureEngineeringReport,
} from "../types/api";

export function listDatasets(projectId: number) {
  return apiClient
    .get<Dataset[]>(`/api/projects/${projectId}/datasets`)
    .then((r) => r.data);
}

export function uploadDataset(projectId: number, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient
    .post<DatasetUploadResult>(`/api/projects/${projectId}/datasets`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
}

export function getDatasetProfile(projectId: number, datasetId: number) {
  return apiClient
    .get<DatasetProfile>(`/api/projects/${projectId}/datasets/${datasetId}/profile`)
    .then((r) => r.data);
}

export function setTargetColumn(projectId: number, datasetId: number, targetColumn: string) {
  return apiClient
    .put<TargetSelectionResult>(`/api/projects/${projectId}/datasets/${datasetId}/target`, {
      target_column: targetColumn,
    })
    .then((r) => r.data);
}

export function runPreprocessing(projectId: number, datasetId: number) {
  return apiClient
    .post<PreprocessingReport>(`/api/projects/${projectId}/datasets/${datasetId}/preprocess`)
    .then((r) => r.data);
}

export function runFeatureEngineering(projectId: number, datasetId: number) {
  return apiClient
    .post<FeatureEngineeringReport>(
      `/api/projects/${projectId}/datasets/${datasetId}/feature-engineering`,
    )
    .then((r) => r.data);
}
