from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PredictionResult(BaseModel):
    prediction: str | float
    probability: float | None = None


class PredictionHistoryEntry(BaseModel):
    id: int
    model_name: str
    prediction_type: str
    row_count: int
    avg_confidence: float | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PredictionTrendPoint(BaseModel):
    date: str
    count: int


class PredictionStats(BaseModel):
    total_predictions: int
    most_used_model: str | None
    average_confidence: float | None
    trends: list[PredictionTrendPoint]
