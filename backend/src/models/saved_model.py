from datetime import datetime

from pydantic import BaseModel


class SavedModelOut(BaseModel):
    model_name: str
    target_column: str
    problem_type: str
    class_labels: list[str] | None = None
    feature_columns: list[str]
    saved_at: datetime
