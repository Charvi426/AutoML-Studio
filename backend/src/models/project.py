from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProjectCreate(BaseModel):
    project_name: str


class ProjectOut(BaseModel):
    id: int
    project_name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
