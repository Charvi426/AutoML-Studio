import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
from catboost import Pool

from src.database.models import Dataset, ModelResult, TrainingRun
from src.services.preprocessing_service import run_preprocessing

LINEAR_MODEL_NAMES = {"logistic_regression", "linear_regression"}
CLASSIFICATION_PROBLEM_TYPES = {"binary_classification", "multiclass_classification"}


class ExplainabilityError(Exception):
    pass


def _clean_feature_names(preprocessor) -> list[str]:
    names = []
    for name in preprocessor.get_feature_names_out():
        if "__" in name:
            name = name.split("__", 1)[1]
        names.append(name)
    return names


def _load_context(dataset: Dataset, training_run: TrainingRun, model_result: ModelResult):
    df = pd.read_csv(Path(dataset.file_path))
    result = run_preprocessing(df, training_run.target_column, training_run.problem_type)
    pipeline = joblib.load(model_result.model_file_path)
    model = pipeline.named_steps["model"]
    feature_names = _clean_feature_names(pipeline.named_steps["preprocessor"])
    return model, feature_names, result


def _catboost_multiclass_shap(model, X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    # shap.TreeExplainer segfaults for CatBoost + multiclass with this environment's
    # shap/numpy versions (confirmed via isolated reproduction); CatBoost's own native
    # SHAP computation sidesteps that entirely and is otherwise equivalent.
    native = model.get_feature_importance(data=Pool(X), type="ShapValues")  # (samples, classes, features+1)
    values = native[:, :, :-1].transpose(0, 2, 1)  # -> (samples, features, classes)
    base_values = native[0, :, -1]  # (classes,)
    return values, base_values


def _compute_shap(
    model_name: str, model, X_train: np.ndarray, X_target: np.ndarray, problem_type: str
) -> tuple[np.ndarray, np.ndarray]:
    if model_name == "catboost" and problem_type == "multiclass_classification":
        return _catboost_multiclass_shap(model, X_target)

    if model_name in LINEAR_MODEL_NAMES:
        explainer = shap.LinearExplainer(model, X_train)
    else:
        explainer = shap.TreeExplainer(model)

    values = explainer.shap_values(X_target)
    base_values = explainer.expected_value

    if isinstance(values, list):
        values = np.stack(values, axis=-1)
    return np.asarray(values), np.asarray(base_values)


def get_summary(dataset: Dataset, training_run: TrainingRun, model_result: ModelResult) -> dict:
    model, feature_names, result = _load_context(dataset, training_run, model_result)
    values, _ = _compute_shap(model_result.model_name, model, result.X_train, result.X_test, training_run.problem_type)

    abs_vals = np.abs(values).mean(axis=2) if values.ndim == 3 else np.abs(values)
    mean_abs = abs_vals.mean(axis=0)
    order = np.argsort(mean_abs)[::-1]

    return {
        "model_name": model_result.model_name,
        "feature_importance": [{"feature": feature_names[i], "mean_abs_shap": float(mean_abs[i])} for i in order],
    }


def get_instance_explanation(
    dataset: Dataset, training_run: TrainingRun, model_result: ModelResult, row_index: int
) -> dict:
    model, feature_names, result = _load_context(dataset, training_run, model_result)

    n_test = result.X_test.shape[0]
    if row_index < 0 or row_index >= n_test:
        raise ExplainabilityError(f"row_index must be between 0 and {n_test - 1}")

    target_row = result.X_test[row_index : row_index + 1]
    values, base_values = _compute_shap(
        model_result.model_name, model, result.X_train, target_row, training_run.problem_type
    )

    is_classification = training_run.problem_type in CLASSIFICATION_PROBLEM_TYPES
    class_labels = json.loads(training_run.class_labels_json) if training_run.class_labels_json else None

    predicted_class = None
    explained_class = None
    row_values = values[0]  # (features,) or (features, classes)

    if row_values.ndim == 2:
        # Multi-output SHAP (RandomForest even for binary, or any model for multiclass):
        # explain the class the model actually predicted for this instance.
        pred_idx = int(np.ravel(model.predict(target_row))[0])
        row_values = row_values[:, pred_idx]
        base_value = float(base_values[pred_idx])
        predicted_value = float(model.predict_proba(target_row)[0][pred_idx])
        if class_labels:
            predicted_class = class_labels[pred_idx]
            explained_class = predicted_class
    else:
        base_value = float(np.ravel(base_values)[0])
        if is_classification:
            pred_idx = int(np.ravel(model.predict(target_row))[0])
            # Single-output SHAP for binary models always explains the positive
            # (second, higher-indexed) class's log-odds, regardless of what was predicted,
            # so predicted_value reports that same class's probability for consistency
            # with the contributions below (rather than whichever class "won").
            predicted_value = float(model.predict_proba(target_row)[0][-1])
            if class_labels:
                predicted_class = class_labels[pred_idx]
                explained_class = class_labels[-1]
        else:
            predicted_value = float(np.ravel(model.predict(target_row))[0])

    contributions = sorted(
        (
            {"feature": feature_names[i], "value": float(target_row[0, i]), "shap_value": float(row_values[i])}
            for i in range(len(feature_names))
        ),
        key=lambda c: abs(c["shap_value"]),
        reverse=True,
    )

    return {
        "model_name": model_result.model_name,
        "row_index": row_index,
        "predicted_class": predicted_class,
        "explained_class": explained_class,
        "base_value": base_value,
        "predicted_value": predicted_value,
        "contributions": contributions,
    }
