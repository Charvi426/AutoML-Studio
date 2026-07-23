from pathlib import Path

import numpy as np
import pandas as pd

from src.models.profile import (
    BoxplotStats,
    ColumnStats,
    CorrelationMatrix,
    DatasetProfile,
    Histogram,
    MissingValueEntry,
    ValueCount,
)
from src.utils.pandas_utils import to_native as _native

SAMPLE_SIZE = 50
TOP_VALUES_LIMIT = 10
HISTOGRAM_BINS = 10


def _column_stats(df: pd.DataFrame, column: str, is_numeric: bool) -> ColumnStats:
    series = df[column]
    n = len(df)
    missing_count = int(series.isna().sum())
    missing_pct = round(missing_count / n * 100, 2) if n else 0.0
    non_null = series.dropna()

    if is_numeric:
        mode_series = non_null.mode()
        return ColumnStats(
            name=column,
            dtype="numeric",
            missing_count=missing_count,
            missing_pct=missing_pct,
            mean=_native(non_null.mean()) if not non_null.empty else None,
            median=_native(non_null.median()) if not non_null.empty else None,
            mode=_native(mode_series.iloc[0]) if not mode_series.empty else None,
            min=_native(non_null.min()) if not non_null.empty else None,
            max=_native(non_null.max()) if not non_null.empty else None,
            std=_native(non_null.std()) if len(non_null) > 1 else None,
        )

    value_counts = non_null.astype(str).value_counts().head(TOP_VALUES_LIMIT)
    mode_series = non_null.mode()
    return ColumnStats(
        name=column,
        dtype="categorical",
        missing_count=missing_count,
        missing_pct=missing_pct,
        mode=str(mode_series.iloc[0]) if not mode_series.empty else None,
        unique_count=int(non_null.nunique()),
        top_values=[ValueCount(value=str(v), count=int(c)) for v, c in value_counts.items()],
    )


def _correlation_matrix(df: pd.DataFrame, numeric_columns: list[str]) -> CorrelationMatrix | None:
    if len(numeric_columns) < 2:
        return None
    corr = df[numeric_columns].corr(numeric_only=True)
    matrix = [[_native(v) for v in row] for row in corr.to_numpy()]
    return CorrelationMatrix(columns=numeric_columns, matrix=matrix)


def _histogram(df: pd.DataFrame, column: str) -> Histogram | None:
    values = df[column].dropna()
    if values.nunique() < 2:
        return None
    counts, edges = np.histogram(values, bins=HISTOGRAM_BINS)
    return Histogram(column=column, bin_edges=[round(float(e), 4) for e in edges], counts=[int(c) for c in counts])


def _boxplot(df: pd.DataFrame, column: str) -> BoxplotStats | None:
    values = df[column].dropna()
    if values.empty:
        return None
    q1, median, q3 = np.percentile(values, [25, 50, 75])
    iqr = q3 - q1
    lower_whisker = max(float(values.min()), q1 - 1.5 * iqr)
    upper_whisker = min(float(values.max()), q3 + 1.5 * iqr)
    return BoxplotStats(
        column=column,
        min=float(values.min()),
        q1=float(q1),
        median=float(median),
        q3=float(q3),
        max=float(values.max()),
        lower_whisker=float(lower_whisker),
        upper_whisker=float(upper_whisker),
    )


def _sample_rows(df: pd.DataFrame) -> list[dict]:
    sample = df.sample(min(SAMPLE_SIZE, len(df)), random_state=42).sort_index()
    return [{col: _native(val) for col, val in row.items()} for _, row in sample.iterrows()]


def generate_profile(file_path: str) -> DatasetProfile:
    df = pd.read_csv(Path(file_path))
    n_rows = len(df)

    numeric_columns = df.select_dtypes(include="number").columns.tolist()
    categorical_columns = [c for c in df.columns if c not in numeric_columns]

    total_cells = df.shape[0] * df.shape[1]
    missing_values_pct = round(float(df.isna().sum().sum()) / total_cells * 100, 2) if total_cells else 0.0

    column_stats = [_column_stats(df, col, col in numeric_columns) for col in df.columns]
    missing_values = [
        MissingValueEntry(
            column=col,
            missing_count=int(df[col].isna().sum()),
            missing_pct=round(float(df[col].isna().sum()) / n_rows * 100, 2) if n_rows else 0.0,
        )
        for col in df.columns
    ]

    histograms = [hist for col in numeric_columns if (hist := _histogram(df, col)) is not None]
    boxplots = [box for col in numeric_columns if (box := _boxplot(df, col)) is not None]

    return DatasetProfile(
        rows=n_rows,
        columns=len(df.columns),
        missing_values_pct=missing_values_pct,
        duplicate_rows=int(df.duplicated().sum()),
        numeric_columns=len(numeric_columns),
        categorical_columns=len(categorical_columns),
        column_stats=column_stats,
        missing_values=missing_values,
        correlation_matrix=_correlation_matrix(df, numeric_columns),
        histograms=histograms,
        boxplots=boxplots,
        sample_rows=_sample_rows(df),
    )
