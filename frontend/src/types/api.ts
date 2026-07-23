// --- Auth ---
export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

// --- Projects ---
export interface Project {
  id: number;
  project_name: string;
  created_at: string;
}

// --- Datasets ---
export interface Dataset {
  id: number;
  filename: string;
  rows: number;
  columns: number;
  uploaded_at: string;
  target_column: string | null;
  problem_type: string | null;
}

export interface DatasetUploadResult extends Dataset {
  memory: string;
  duplicate_rows: number;
  target_candidates: string[];
}

// --- Profiling ---
export interface ValueCount {
  value: string;
  count: number;
}

export interface ColumnStats {
  name: string;
  dtype: "numeric" | "categorical";
  missing_count: number;
  missing_pct: number;
  mean: number | null;
  median: number | null;
  mode: number | string | null;
  min: number | null;
  max: number | null;
  std: number | null;
  unique_count: number | null;
  top_values: ValueCount[] | null;
}

export interface MissingValueEntry {
  column: string;
  missing_count: number;
  missing_pct: number;
}

export interface CorrelationMatrix {
  columns: string[];
  matrix: (number | null)[][];
}

export interface Histogram {
  column: string;
  bin_edges: number[];
  counts: number[];
}

export interface BoxplotStats {
  column: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  lower_whisker: number;
  upper_whisker: number;
}

export interface DatasetProfile {
  rows: number;
  columns: number;
  missing_values_pct: number;
  duplicate_rows: number;
  numeric_columns: number;
  categorical_columns: number;
  column_stats: ColumnStats[];
  missing_values: MissingValueEntry[];
  correlation_matrix: CorrelationMatrix | null;
  histograms: Histogram[];
  boxplots: BoxplotStats[];
  sample_rows: Record<string, unknown>[];
}

// --- Target selection ---
export interface ClassCount {
  value: string;
  count: number;
}

export interface RegressionSummary {
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  std: number | null;
}

export interface TargetSelectionResult {
  target_column: string;
  problem_type: string;
  class_distribution: ClassCount[] | null;
  regression_summary: RegressionSummary | null;
}

// --- Preprocessing ---
export interface MissingValueStrategy {
  column: string;
  strategy: string;
  fill_value: number | string;
  missing_count: number;
}

export interface EncodingStrategy {
  column: string;
  strategy: string;
  categories_count: number;
  resulting_columns: number;
}

export interface ScalingInfo {
  method: string;
  columns: string[];
}

export interface OutlierColumnClip {
  column: string;
  clipped_count: number;
}

export interface OutlierHandling {
  method: string;
  total_values_clipped: number;
  per_column: OutlierColumnClip[];
}

export interface SplitInfo {
  train_rows: number;
  test_rows: number;
  test_size: number;
  stratified: boolean;
}

export interface PreprocessingReport {
  target_column: string;
  problem_type: string;
  feature_count_before: number;
  feature_count_after: number;
  missing_values: MissingValueStrategy[];
  encoding: EncodingStrategy[];
  scaling: ScalingInfo;
  outlier_handling: OutlierHandling;
  split: SplitInfo;
}

// --- Feature engineering ---
export interface DateFeatureInfo {
  column: string;
  derived_columns: string[];
}

export interface InteractionFeatureInfo {
  feature_name: string;
  columns: string[];
}

export interface PolynomialFeatureInfo {
  column: string;
  feature_name: string;
}

export interface FrequencyEncodingInfo {
  column: string;
  feature_name: string;
}

export interface TargetEncodingInfo {
  column: string;
  feature_name: string;
}

export interface DroppedFeatureInfo {
  dropped_column: string;
  correlated_with: string;
  correlation: number;
}

export interface FeatureEngineeringReport {
  date_features: DateFeatureInfo[];
  interaction_features: InteractionFeatureInfo[];
  interaction_features_skipped_reason: string | null;
  polynomial_features: PolynomialFeatureInfo[];
  frequency_encoded: FrequencyEncodingInfo[];
  target_encoded: TargetEncodingInfo[];
  target_encoding_skipped_reason: string | null;
  dropped_correlated_features: DroppedFeatureInfo[];
  feature_count_before: number;
  feature_count_after: number;
}

// --- Training ---
export interface ModelResultOut {
  id: number;
  model_name: string;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  roc_auc: number | null;
  mae: number | null;
  rmse: number | null;
  r2: number | null;
  training_time_seconds: number;
  created_at: string;
}

export interface TrainingRunOut {
  id: number;
  target_column: string;
  problem_type: string;
  class_labels: string[] | null;
  created_at: string;
  model_results: ModelResultOut[];
  best_model_name: string | null;
}

export interface TrainingRunSummary {
  id: number;
  target_column: string;
  problem_type: string;
  created_at: string;
  model_count: number;
  best_model_name: string | null;
}

// --- Explainability ---
export interface FeatureImportance {
  feature: string;
  mean_abs_shap: number;
}

export interface ShapSummary {
  model_name: string;
  feature_importance: FeatureImportance[];
}

export interface FeatureContribution {
  feature: string;
  value: number;
  shap_value: number;
}

export interface ShapInstanceExplanation {
  model_name: string;
  row_index: number;
  predicted_class: string | null;
  explained_class: string | null;
  base_value: number;
  predicted_value: number;
  contributions: FeatureContribution[];
}

// --- Saved model ---
export interface SavedModelOut {
  model_name: string;
  target_column: string;
  problem_type: string;
  class_labels: string[] | null;
  feature_columns: string[];
  saved_at: string;
}

// --- Predictions ---
export interface PredictionResult {
  prediction: string | number;
  probability: number | null;
}

export interface PredictionHistoryEntry {
  id: number;
  model_name: string;
  prediction_type: "single" | "batch";
  row_count: number;
  avg_confidence: number | null;
  created_at: string;
}

export interface PredictionTrendPoint {
  date: string;
  count: number;
}

export interface PredictionStats {
  total_predictions: number;
  most_used_model: string | null;
  average_confidence: number | null;
  trends: PredictionTrendPoint[];
}
