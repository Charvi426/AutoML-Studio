from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DatasetOut(BaseModel):
    id: int
    filename: str
    rows: int
    columns: int
    uploaded_at: datetime
    target_column: str | None = None
    problem_type: str | None = None

    model_config = ConfigDict(from_attributes=True)


class DatasetUploadResult(DatasetOut):
    memory: str
    duplicate_rows: int
    target_candidates: list[str]
