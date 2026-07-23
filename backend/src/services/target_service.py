from pathlib import Path

import pandas as pd
from fastapi import HTTPException, status

from src.utils.pandas_utils import to_native

MAX_CLASSIFICATION_CATEGORIES = 20


class TargetValidationError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _detect_problem_type(series: pd.Series) -> str:
    non_null = series.dropna()
    nunique = non_null.nunique()

    if nunique < 2:
        raise TargetValidationError("Target column must have at least 2 distinct values")

    if nunique == 2:
        return "binary_classification"

    if nunique <= MAX_CLASSIFICATION_CATEGORIES:
        return "multiclass_classification"

    if pd.api.types.is_numeric_dtype(non_null):
        return "regression"

    raise TargetValidationError(
        f"Column has {nunique} distinct text values — too many for a classification target "
        "and not numeric, so it can't be a regression target either"
    )


def _classification_distribution(series: pd.Series) -> list[dict]:
    counts = series.dropna().astype(str).value_counts()
    return [{"value": str(value), "count": int(count)} for value, count in counts.items()]


def _regression_summary(series: pd.Series) -> dict:
    non_null = series.dropna()
    return {
        "mean": to_native(non_null.mean()),
        "median": to_native(non_null.median()),
        "min": to_native(non_null.min()),
        "max": to_native(non_null.max()),
        "std": to_native(non_null.std()) if len(non_null) > 1 else None,
    }


def analyze_target(file_path: str, target_column: str) -> dict:
    header = pd.read_csv(Path(file_path), nrows=0).columns.tolist()
    if target_column not in header:
        raise TargetValidationError(f"Column '{target_column}' does not exist in this dataset")

    series = pd.read_csv(Path(file_path), usecols=[target_column])[target_column]
    problem_type = _detect_problem_type(series)

    if problem_type == "regression":
        return {"problem_type": problem_type, "class_distribution": None, "regression_summary": _regression_summary(series)}

    return {
        "problem_type": problem_type,
        "class_distribution": _classification_distribution(series),
        "regression_summary": None,
    }
