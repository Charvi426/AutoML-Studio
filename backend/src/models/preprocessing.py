from pydantic import BaseModel


class MissingValueStrategy(BaseModel):
    column: str
    strategy: str  # "median" or "mode"
    fill_value: float | str
    missing_count: int


class EncodingStrategy(BaseModel):
    column: str
    strategy: str  # "one_hot" or "ordinal"
    categories_count: int
    resulting_columns: int


class ScalingInfo(BaseModel):
    method: str
    columns: list[str]


class OutlierColumnClip(BaseModel):
    column: str
    clipped_count: int


class OutlierHandling(BaseModel):
    method: str
    total_values_clipped: int
    per_column: list[OutlierColumnClip]


class SplitInfo(BaseModel):
    train_rows: int
    test_rows: int
    test_size: float
    stratified: bool


class PreprocessingReport(BaseModel):
    target_column: str
    problem_type: str
    feature_count_before: int
    feature_count_after: int
    missing_values: list[MissingValueStrategy]
    encoding: list[EncodingStrategy]
    scaling: ScalingInfo
    outlier_handling: OutlierHandling
    split: SplitInfo
