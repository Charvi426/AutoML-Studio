from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, StandardScaler

from src.models.preprocessing import (
    EncodingStrategy,
    MissingValueStrategy,
    OutlierColumnClip,
    OutlierHandling,
    PreprocessingReport,
    ScalingInfo,
    SplitInfo,
)
from src.utils.pandas_utils import to_native

ONE_HOT_MAX_CATEGORIES = 10
TEST_SIZE = 0.2
RANDOM_STATE = 42
OUTLIER_CLIP_STD = 3.0

CLASSIFICATION_PROBLEM_TYPES = {"binary_classification", "multiclass_classification"}


def _missing_value_summary(
    X: pd.DataFrame, numeric_cols: list[str], categorical_cols: list[str]
) -> list[MissingValueStrategy]:
    summary = []
    for col in numeric_cols:
        missing_count = int(X[col].isna().sum())
        if missing_count == 0:
            continue
        summary.append(
            MissingValueStrategy(
                column=col, strategy="median", fill_value=to_native(X[col].median()), missing_count=missing_count
            )
        )
    for col in categorical_cols:
        missing_count = int(X[col].isna().sum())
        if missing_count == 0:
            continue
        mode = X[col].mode()
        fill_value = str(mode.iloc[0]) if not mode.empty else ""
        summary.append(
            MissingValueStrategy(column=col, strategy="mode", fill_value=fill_value, missing_count=missing_count)
        )
    return summary


def _build_column_transformer(
    numeric_cols: list[str], low_card_cols: list[str], high_card_cols: list[str]
) -> ColumnTransformer:
    transformers = []
    if numeric_cols:
        numeric_pipeline = Pipeline(
            [("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())]
        )
        transformers.append(("numeric", numeric_pipeline, numeric_cols))
    if low_card_cols:
        low_card_pipeline = Pipeline(
            [
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
            ]
        )
        transformers.append(("cat_onehot", low_card_pipeline, low_card_cols))
    if high_card_cols:
        high_card_pipeline = Pipeline(
            [
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("encoder", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)),
            ]
        )
        transformers.append(("cat_ordinal", high_card_pipeline, high_card_cols))
    return ColumnTransformer(transformers)


@dataclass
class PreprocessingResult:
    preprocessor: ColumnTransformer
    X_train: np.ndarray
    X_test: np.ndarray
    y_train: pd.Series
    y_test: pd.Series
    report: PreprocessingReport


def run_preprocessing(df: pd.DataFrame, target_column: str, problem_type: str) -> PreprocessingResult:
    X = df.drop(columns=[target_column])
    y = df[target_column]

    numeric_cols = X.select_dtypes(include="number").columns.tolist()
    categorical_cols = [c for c in X.columns if c not in numeric_cols]
    low_card_cols = [c for c in categorical_cols if X[c].nunique(dropna=True) <= ONE_HOT_MAX_CATEGORIES]
    high_card_cols = [c for c in categorical_cols if c not in low_card_cols]

    missing_values = _missing_value_summary(X, numeric_cols, categorical_cols)

    encoding_summary = []
    for col in low_card_cols:
        n = int(X[col].nunique(dropna=True))
        encoding_summary.append(EncodingStrategy(column=col, strategy="one_hot", categories_count=n, resulting_columns=n))
    for col in high_card_cols:
        n = int(X[col].nunique(dropna=True))
        encoding_summary.append(EncodingStrategy(column=col, strategy="ordinal", categories_count=n, resulting_columns=1))

    is_classification = problem_type in CLASSIFICATION_PROBLEM_TYPES
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y if is_classification else None
        )
        stratified = is_classification
    except ValueError:
        # e.g. a class with only 1 member can't be stratified
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE)
        stratified = False

    preprocessor = _build_column_transformer(numeric_cols, low_card_cols, high_card_cols)
    X_train_transformed = preprocessor.fit_transform(X_train)
    X_test_transformed = preprocessor.transform(X_test)

    total_clipped = 0
    per_column_clips = []
    if numeric_cols:
        n_numeric = len(numeric_cols)
        for i, col in enumerate(numeric_cols):
            train_col = X_train_transformed[:, i]
            test_col = X_test_transformed[:, i]
            clipped_count = int(np.sum(np.abs(train_col) > OUTLIER_CLIP_STD)) + int(
                np.sum(np.abs(test_col) > OUTLIER_CLIP_STD)
            )
            if clipped_count:
                per_column_clips.append(OutlierColumnClip(column=col, clipped_count=clipped_count))
            total_clipped += clipped_count
        np.clip(X_train_transformed[:, :n_numeric], -OUTLIER_CLIP_STD, OUTLIER_CLIP_STD, out=X_train_transformed[:, :n_numeric])
        np.clip(X_test_transformed[:, :n_numeric], -OUTLIER_CLIP_STD, OUTLIER_CLIP_STD, out=X_test_transformed[:, :n_numeric])

    report = PreprocessingReport(
        target_column=target_column,
        problem_type=problem_type,
        feature_count_before=len(X.columns),
        feature_count_after=X_train_transformed.shape[1],
        missing_values=missing_values,
        encoding=encoding_summary,
        scaling=ScalingInfo(method="StandardScaler", columns=numeric_cols),
        outlier_handling=OutlierHandling(
            method=f"Clip standardized values beyond +/-{OUTLIER_CLIP_STD} std",
            total_values_clipped=total_clipped,
            per_column=per_column_clips,
        ),
        split=SplitInfo(train_rows=len(X_train), test_rows=len(X_test), test_size=TEST_SIZE, stratified=stratified),
    )

    return PreprocessingResult(
        preprocessor=preprocessor,
        X_train=X_train_transformed,
        X_test=X_test_transformed,
        y_train=y_train,
        y_test=y_test,
        report=report,
    )


def build_preprocessing_report(file_path: str, target_column: str, problem_type: str) -> PreprocessingReport:
    df = pd.read_csv(Path(file_path))
    return run_preprocessing(df, target_column, problem_type).report
