import json
import time
from pathlib import Path

import joblib
import mlflow
import pandas as pd
from catboost import CatBoostClassifier, CatBoostRegressor
from lightgbm import LGBMClassifier, LGBMRegressor
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    precision_score,
    r2_score,
    recall_score,
    root_mean_squared_error,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder
from sqlalchemy.orm import Session
from xgboost import XGBClassifier, XGBRegressor

from src.database.models import Dataset, ModelResult, TrainingRun
from src.services.preprocessing_service import run_preprocessing
from src.utils.config import settings

RANDOM_STATE = 42
CLASSIFICATION_PROBLEM_TYPES = {"binary_classification", "multiclass_classification"}


def _build_models(problem_type: str) -> dict[str, object]:
    if problem_type in CLASSIFICATION_PROBLEM_TYPES:
        return {
            "logistic_regression": LogisticRegression(max_iter=1000, random_state=RANDOM_STATE),
            "random_forest": RandomForestClassifier(n_estimators=300, random_state=RANDOM_STATE),
            "xgboost": XGBClassifier(random_state=RANDOM_STATE, eval_metric="logloss"),
            "lightgbm": LGBMClassifier(random_state=RANDOM_STATE, verbose=-1),
            "catboost": CatBoostClassifier(random_state=RANDOM_STATE, verbose=False, allow_writing_files=False),
        }
    return {
        "linear_regression": LinearRegression(),
        "random_forest": RandomForestRegressor(n_estimators=300, random_state=RANDOM_STATE),
        "xgboost": XGBRegressor(random_state=RANDOM_STATE),
        "lightgbm": LGBMRegressor(random_state=RANDOM_STATE, verbose=-1),
        "catboost": CatBoostRegressor(random_state=RANDOM_STATE, verbose=False, allow_writing_files=False),
    }


def _evaluate_classification(y_true, y_pred, y_proba, is_binary: bool) -> dict:
    average = "binary" if is_binary else "weighted"
    metrics = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, average=average, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, average=average, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, average=average, zero_division=0)),
        "roc_auc": None,
    }
    try:
        if is_binary:
            metrics["roc_auc"] = float(roc_auc_score(y_true, y_proba[:, 1]))
        else:
            metrics["roc_auc"] = float(roc_auc_score(y_true, y_proba, multi_class="ovr", average="weighted"))
    except ValueError:
        pass  # e.g. a class missing from the test split
    return metrics


def _evaluate_regression(y_true, y_pred) -> dict:
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(root_mean_squared_error(y_true, y_pred)),
        "r2": float(r2_score(y_true, y_pred)),
    }


def _loggable_params(model) -> dict[str, str]:
    params = {}
    for key, value in model.get_params().items():
        if value is None or isinstance(value, (str, int, float, bool)):
            text = str(value)
            if len(text) <= 250:
                params[key] = text
    return params


def run_training(db: Session, dataset: Dataset) -> TrainingRun:
    df = pd.read_csv(Path(dataset.file_path))
    result = run_preprocessing(df, dataset.target_column, dataset.problem_type)

    is_classification = dataset.problem_type in CLASSIFICATION_PROBLEM_TYPES
    class_labels: list[str] | None = None

    if is_classification:
        encoder = LabelEncoder()
        y_train = encoder.fit_transform(result.y_train)
        y_test = encoder.transform(result.y_test)
        class_labels = [str(c) for c in encoder.classes_]
    else:
        y_train = result.y_train.to_numpy()
        y_test = result.y_test.to_numpy()

    models = _build_models(dataset.problem_type)

    training_run = TrainingRun(
        dataset_id=dataset.id,
        target_column=dataset.target_column,
        problem_type=dataset.problem_type,
        class_labels_json=json.dumps(class_labels) if class_labels else None,
    )
    db.add(training_run)
    db.commit()
    db.refresh(training_run)

    run_dir = Path(settings.experiments_dir) / f"project_{dataset.project_id}" / f"dataset_{dataset.id}" / f"run_{training_run.id}"
    run_dir.mkdir(parents=True, exist_ok=True)

    is_binary = dataset.problem_type == "binary_classification"

    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    mlflow.set_experiment(f"project_{dataset.project_id}_dataset_{dataset.id}")

    with mlflow.start_run(run_name=f"training_run_{training_run.id}"):
        mlflow.set_tag("target_column", dataset.target_column)
        mlflow.set_tag("problem_type", dataset.problem_type)

        for model_name, model in models.items():
            start = time.perf_counter()
            model.fit(result.X_train, y_train)
            elapsed = time.perf_counter() - start

            y_pred = model.predict(result.X_test)
            if is_classification:
                y_proba = model.predict_proba(result.X_test)
                metrics = _evaluate_classification(y_test, y_pred, y_proba, is_binary)
            else:
                metrics = _evaluate_regression(y_test, y_pred)

            full_pipeline = Pipeline([("preprocessor", result.preprocessor), ("model", model)])
            model_path = run_dir / f"{model_name}.pkl"
            joblib.dump(full_pipeline, model_path)

            with mlflow.start_run(run_name=model_name, nested=True):
                mlflow.log_param("model_name", model_name)
                mlflow.log_params(_loggable_params(model))
                mlflow.log_metrics({k: v for k, v in metrics.items() if v is not None})
                mlflow.log_metric("training_time_seconds", elapsed)
                mlflow.log_artifact(str(model_path))

            db.add(
                ModelResult(
                    training_run_id=training_run.id,
                    model_name=model_name,
                    training_time_seconds=round(elapsed, 4),
                    model_file_path=str(model_path),
                    **metrics,
                )
            )

    db.commit()
    db.refresh(training_run)
    return training_run


def list_training_runs(db: Session, dataset_id: int) -> list[TrainingRun]:
    return db.query(TrainingRun).filter(TrainingRun.dataset_id == dataset_id).order_by(TrainingRun.created_at.desc()).all()


def get_training_run(db: Session, dataset_id: int, run_id: int) -> TrainingRun | None:
    return db.query(TrainingRun).filter(TrainingRun.id == run_id, TrainingRun.dataset_id == dataset_id).first()


def get_best_model_name(training_run: TrainingRun) -> str | None:
    if not training_run.model_results:
        return None

    if training_run.problem_type in CLASSIFICATION_PROBLEM_TYPES:
        def classification_key(mr: ModelResult):
            return (
                mr.roc_auc if mr.roc_auc is not None else -1,
                mr.f1 if mr.f1 is not None else -1,
                mr.accuracy if mr.accuracy is not None else -1,
            )

        best = max(training_run.model_results, key=classification_key)
    else:
        def regression_key(mr: ModelResult):
            r2 = mr.r2 if mr.r2 is not None else float("-inf")
            neg_rmse = -mr.rmse if mr.rmse is not None else float("-inf")
            return (r2, neg_rmse)

        best = max(training_run.model_results, key=regression_key)

    return best.model_name


def get_model_result(training_run: TrainingRun, model_name: str) -> ModelResult | None:
    for mr in training_run.model_results:
        if mr.model_name == model_name:
            return mr
    return None
