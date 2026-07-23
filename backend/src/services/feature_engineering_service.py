import itertools
from pathlib import Path

import pandas as pd

from src.models.feature_engineering import (
    DateFeatureInfo,
    DroppedFeatureInfo,
    FeatureEngineeringReport,
    FrequencyEncodingInfo,
    InteractionFeatureInfo,
    PolynomialFeatureInfo,
    TargetEncodingInfo,
)

DATE_PARSE_SUCCESS_THRESHOLD = 0.9
MAX_NUMERIC_FOR_INTERACTIONS = 6
CORRELATION_DROP_THRESHOLD = 0.95


def _detect_date_columns(X: pd.DataFrame, categorical_cols: list[str]) -> list[str]:
    date_cols = []
    for col in categorical_cols:
        non_null = X[col].dropna()
        if non_null.empty:
            continue
        parsed = pd.to_datetime(non_null, errors="coerce", format="mixed")
        success_rate = parsed.notna().sum() / len(non_null)
        if success_rate >= DATE_PARSE_SUCCESS_THRESHOLD:
            date_cols.append(col)
    return date_cols


def _add_date_features(X: pd.DataFrame, date_cols: list[str]) -> tuple[pd.DataFrame, list[DateFeatureInfo]]:
    info = []
    for col in date_cols:
        parsed = pd.to_datetime(X[col], errors="coerce", format="mixed")
        year_col, month_col, weekday_col = f"{col}_year", f"{col}_month", f"{col}_weekday"
        X[year_col] = parsed.dt.year
        X[month_col] = parsed.dt.month
        X[weekday_col] = parsed.dt.weekday
        X = X.drop(columns=[col])
        info.append(DateFeatureInfo(column=col, derived_columns=[year_col, month_col, weekday_col]))
    return X, info


def _add_interaction_features(
    X: pd.DataFrame, numeric_cols: list[str]
) -> tuple[pd.DataFrame, list[InteractionFeatureInfo], str | None]:
    if len(numeric_cols) < 2:
        return X, [], None
    if len(numeric_cols) > MAX_NUMERIC_FOR_INTERACTIONS:
        return X, [], (
            f"Skipped: {len(numeric_cols)} numeric columns exceeds the cap of {MAX_NUMERIC_FOR_INTERACTIONS} "
            "(pairwise interactions would explode combinatorially)"
        )
    info = []
    for a, b in itertools.combinations(numeric_cols, 2):
        feature_name = f"{a}_x_{b}"
        X[feature_name] = X[a] * X[b]
        info.append(InteractionFeatureInfo(feature_name=feature_name, columns=[a, b]))
    return X, info, None


def _add_polynomial_features(
    X: pd.DataFrame, numeric_cols: list[str]
) -> tuple[pd.DataFrame, list[PolynomialFeatureInfo]]:
    info = []
    for col in numeric_cols:
        feature_name = f"{col}_squared"
        X[feature_name] = X[col] ** 2
        info.append(PolynomialFeatureInfo(column=col, feature_name=feature_name))
    return X, info


def _add_frequency_encoding(
    X: pd.DataFrame, categorical_cols: list[str]
) -> tuple[pd.DataFrame, list[FrequencyEncodingInfo]]:
    info = []
    for col in categorical_cols:
        freq_map = X[col].value_counts(normalize=True, dropna=True)
        feature_name = f"{col}_freq"
        X[feature_name] = X[col].map(freq_map)
        info.append(FrequencyEncodingInfo(column=col, feature_name=feature_name))
    return X, info


def _add_target_encoding(
    X: pd.DataFrame, categorical_cols: list[str], y: pd.Series, problem_type: str
) -> tuple[pd.DataFrame, list[TargetEncodingInfo], str | None]:
    if not categorical_cols:
        return X, [], None
    if problem_type == "multiclass_classification":
        return X, [], "Skipped: target encoding isn't applied for multiclass targets in this version"

    if problem_type == "binary_classification":
        codes, _ = pd.factorize(y, sort=True)
        numeric_target = pd.Series(codes, index=y.index)
    else:
        numeric_target = y

    info = []
    for col in categorical_cols:
        means = numeric_target.groupby(X[col]).mean()
        feature_name = f"{col}_target_enc"
        X[feature_name] = X[col].map(means)
        info.append(TargetEncodingInfo(column=col, feature_name=feature_name))
    return X, info, None


def _drop_correlated_features(
    X: pd.DataFrame, numeric_cols: list[str]
) -> tuple[pd.DataFrame, list[DroppedFeatureInfo]]:
    if len(numeric_cols) < 2:
        return X, []

    corr = X[numeric_cols].corr(numeric_only=True).abs()
    dropped: set[str] = set()
    info = []
    for col_a, col_b in itertools.combinations(numeric_cols, 2):
        if col_a in dropped or col_b in dropped:
            continue
        value = corr.loc[col_a, col_b]
        if pd.notna(value) and value > CORRELATION_DROP_THRESHOLD:
            dropped.add(col_b)
            info.append(DroppedFeatureInfo(dropped_column=col_b, correlated_with=col_a, correlation=round(float(value), 4)))

    return X.drop(columns=list(dropped)), info


def build_feature_engineering_report(file_path: str, target_column: str, problem_type: str) -> FeatureEngineeringReport:
    df = pd.read_csv(Path(file_path))
    X = df.drop(columns=[target_column])
    y = df[target_column]

    feature_count_before = len(X.columns)

    numeric_cols = X.select_dtypes(include="number").columns.tolist()
    categorical_cols = [c for c in X.columns if c not in numeric_cols]

    date_cols = _detect_date_columns(X, categorical_cols)
    categorical_cols = [c for c in categorical_cols if c not in date_cols]
    X, date_features = _add_date_features(X, date_cols)

    numeric_cols = X.select_dtypes(include="number").columns.tolist()
    X, interaction_features, interaction_skip_reason = _add_interaction_features(X, numeric_cols)

    # Reuse the same pre-interaction numeric_cols so polynomial features square only the
    # original/date-derived numeric columns, not the newly created interaction columns too
    # (squaring those as well would compound the feature count combinatorially).
    X, polynomial_features = _add_polynomial_features(X, numeric_cols)

    X, frequency_encoded = _add_frequency_encoding(X, categorical_cols)
    X, target_encoded, target_encoding_skip_reason = _add_target_encoding(X, categorical_cols, y, problem_type)

    numeric_cols_final = X.select_dtypes(include="number").columns.tolist()
    X, dropped_correlated = _drop_correlated_features(X, numeric_cols_final)

    return FeatureEngineeringReport(
        date_features=date_features,
        interaction_features=interaction_features,
        interaction_features_skipped_reason=interaction_skip_reason,
        polynomial_features=polynomial_features,
        frequency_encoded=frequency_encoded,
        target_encoded=target_encoded,
        target_encoding_skipped_reason=target_encoding_skip_reason,
        dropped_correlated_features=dropped_correlated,
        feature_count_before=feature_count_before,
        feature_count_after=len(X.columns),
    )
