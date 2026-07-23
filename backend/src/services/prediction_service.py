import json

import joblib
import pandas as pd
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from src.database.models import Prediction, SavedModel

CLASSIFICATION_PROBLEM_TYPES = {"binary_classification", "multiclass_classification"}


class PredictionValidationError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _load_pipeline(saved_model: SavedModel):
    return joblib.load(saved_model.file_path)


def _decode_label(saved_model: SavedModel, class_idx: int) -> str:
    labels = json.loads(saved_model.class_labels_json) if saved_model.class_labels_json else None
    return labels[class_idx] if labels else str(class_idx)


def _validate_columns(saved_model: SavedModel, available_columns: list[str]) -> list[str]:
    expected = json.loads(saved_model.feature_columns_json)
    missing = [c for c in expected if c not in available_columns]
    if missing:
        raise PredictionValidationError(f"Missing required fields: {', '.join(missing)}")
    return expected


def predict_single(saved_model: SavedModel, payload: dict) -> dict:
    expected = _validate_columns(saved_model, list(payload.keys()))
    row = pd.DataFrame([payload])[expected]

    pipeline = _load_pipeline(saved_model)
    is_classification = saved_model.problem_type in CLASSIFICATION_PROBLEM_TYPES

    if is_classification:
        proba = pipeline.predict_proba(row)[0]
        class_idx = int(proba.argmax())
        prediction = _decode_label(saved_model, class_idx)
        probability = float(proba[class_idx])
    else:
        prediction = float(pipeline.predict(row)[0])
        probability = None

    return {"prediction": prediction, "probability": probability}


def predict_batch(saved_model: SavedModel, df: pd.DataFrame) -> tuple[pd.DataFrame, float | None]:
    expected = _validate_columns(saved_model, df.columns.tolist())
    features = df[expected]

    pipeline = _load_pipeline(saved_model)
    is_classification = saved_model.problem_type in CLASSIFICATION_PROBLEM_TYPES

    result_df = df.copy()
    if is_classification:
        proba = pipeline.predict_proba(features)
        class_indices = proba.argmax(axis=1)
        result_df["prediction"] = [_decode_label(saved_model, int(i)) for i in class_indices]
        result_df["probability"] = proba.max(axis=1)
        avg_confidence = float(result_df["probability"].mean())
    else:
        result_df["prediction"] = pipeline.predict(features)
        avg_confidence = None

    return result_df, avg_confidence


def log_prediction(
    db: Session,
    project_id: int,
    user_id: int,
    model_name: str,
    prediction_type: str,
    row_count: int,
    avg_confidence: float | None,
) -> Prediction:
    record = Prediction(
        project_id=project_id,
        user_id=user_id,
        model_name=model_name,
        prediction_type=prediction_type,
        row_count=row_count,
        avg_confidence=avg_confidence,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_history(db: Session, project_id: int, limit: int = 100) -> list[Prediction]:
    return (
        db.query(Prediction)
        .filter(Prediction.project_id == project_id)
        .order_by(Prediction.created_at.desc())
        .limit(limit)
        .all()
    )


def get_stats(db: Session, project_id: int) -> dict:
    records = db.query(Prediction).filter(Prediction.project_id == project_id).all()
    total_predictions = sum(r.row_count for r in records)

    model_counts: dict[str, int] = {}
    for r in records:
        model_counts[r.model_name] = model_counts.get(r.model_name, 0) + r.row_count
    most_used_model = max(model_counts, key=model_counts.get) if model_counts else None

    confidences = [r.avg_confidence for r in records if r.avg_confidence is not None]
    average_confidence = float(sum(confidences) / len(confidences)) if confidences else None

    trend_map: dict[str, int] = {}
    for r in records:
        day = r.created_at.date().isoformat()
        trend_map[day] = trend_map.get(day, 0) + r.row_count
    trends = [{"date": d, "count": c} for d, c in sorted(trend_map.items())]

    return {
        "total_predictions": total_predictions,
        "most_used_model": most_used_model,
        "average_confidence": average_confidence,
        "trends": trends,
    }
