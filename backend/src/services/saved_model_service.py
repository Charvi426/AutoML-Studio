import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session

from src.database.models import Dataset, ModelResult, Project, SavedModel, TrainingRun
from src.utils.config import settings


def save_model(
    db: Session, project: Project, dataset: Dataset, training_run: TrainingRun, model_result: ModelResult
) -> SavedModel:
    header = pd.read_csv(Path(dataset.file_path), nrows=0).columns.tolist()
    feature_columns = [c for c in header if c != training_run.target_column]

    project_dir = Path(settings.saved_models_dir) / f"project_{project.id}"
    project_dir.mkdir(parents=True, exist_ok=True)
    dest_path = project_dir / "model.pkl"
    shutil.copy(model_result.model_file_path, dest_path)

    saved = db.query(SavedModel).filter(SavedModel.project_id == project.id).first()
    if saved is None:
        saved = SavedModel(project_id=project.id)
        db.add(saved)

    saved.dataset_id = dataset.id
    saved.training_run_id = training_run.id
    saved.model_name = model_result.model_name
    saved.file_path = str(dest_path)
    saved.target_column = training_run.target_column
    saved.problem_type = training_run.problem_type
    saved.class_labels_json = training_run.class_labels_json
    saved.feature_columns_json = json.dumps(feature_columns)
    saved.saved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(saved)
    return saved


def get_saved_model(db: Session, project_id: int) -> SavedModel | None:
    return db.query(SavedModel).filter(SavedModel.project_id == project_id).first()


def to_out_dict(saved: SavedModel) -> dict:
    return {
        "model_name": saved.model_name,
        "target_column": saved.target_column,
        "problem_type": saved.problem_type,
        "class_labels": json.loads(saved.class_labels_json) if saved.class_labels_json else None,
        "feature_columns": json.loads(saved.feature_columns_json),
        "saved_at": saved.saved_at,
    }
