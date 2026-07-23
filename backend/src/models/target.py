from pydantic import BaseModel


class TargetSelection(BaseModel):
    target_column: str


class ClassCount(BaseModel):
    value: str
    count: int


class RegressionSummary(BaseModel):
    mean: float | None
    median: float | None
    min: float | None
    max: float | None
    std: float | None


class TargetSelectionResult(BaseModel):
    target_column: str
    problem_type: str
    class_distribution: list[ClassCount] | None = None
    regression_summary: RegressionSummary | None = None
