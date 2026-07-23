from pydantic import BaseModel


class ValueCount(BaseModel):
    value: str
    count: int


class ColumnStats(BaseModel):
    name: str
    dtype: str  # "numeric" or "categorical"
    missing_count: int
    missing_pct: float
    mean: float | None = None
    median: float | None = None
    mode: float | str | None = None
    min: float | None = None
    max: float | None = None
    std: float | None = None
    unique_count: int | None = None
    top_values: list[ValueCount] | None = None


class MissingValueEntry(BaseModel):
    column: str
    missing_count: int
    missing_pct: float


class CorrelationMatrix(BaseModel):
    columns: list[str]
    matrix: list[list[float | None]]


class Histogram(BaseModel):
    column: str
    bin_edges: list[float]
    counts: list[int]


class BoxplotStats(BaseModel):
    column: str
    min: float
    q1: float
    median: float
    q3: float
    max: float
    lower_whisker: float
    upper_whisker: float


class DatasetProfile(BaseModel):
    rows: int
    columns: int
    missing_values_pct: float
    duplicate_rows: int
    numeric_columns: int
    categorical_columns: int
    column_stats: list[ColumnStats]
    missing_values: list[MissingValueEntry]
    correlation_matrix: CorrelationMatrix | None
    histograms: list[Histogram]
    boxplots: list[BoxplotStats]
    sample_rows: list[dict]
