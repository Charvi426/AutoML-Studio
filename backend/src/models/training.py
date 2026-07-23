from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ModelResultOut(BaseModel):
    id: int
    model_name: str
    accuracy: float | None = None
    precision: float | None = None
    recall: float | None = None
    f1: float | None = None
    roc_auc: float | None = None
    mae: float | None = None
    rmse: float | None = None
    r2: float | None = None
    training_time_seconds: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TrainingRunOut(BaseModel):
    id: int
    target_column: str
    problem_type: str
    class_labels: list[str] | None = None
    created_at: datetime
    model_results: list[ModelResultOut]
    best_model_name: str | None = None


class TrainingRunSummary(BaseModel):
    id: int
    target_column: str
    problem_type: str
    created_at: datetime
    model_count: int
    best_model_name: str | None = None
