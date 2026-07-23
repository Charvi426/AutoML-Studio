from io import BytesIO
from pathlib import Path

import pandas as pd
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from src.database.models import Dataset
from src.utils.config import settings


class DatasetValidationError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _format_bytes(num_bytes: int) -> str:
    size = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def _detect_target_candidates(df: pd.DataFrame) -> list[str]:
    n_rows = len(df)
    candidates = []
    for col in df.columns:
        nunique = df[col].nunique(dropna=True)
        if nunique < 2:
            continue
        uniqueness_ratio = nunique / n_rows if n_rows else 1
        if uniqueness_ratio > 0.9:
            continue  # looks like an identifier column, not a label
        if nunique <= 20:
            candidates.append(col)
    return candidates


def validate_and_parse_csv(filename: str, content: bytes) -> pd.DataFrame:
    if not filename.lower().endswith(".csv"):
        raise DatasetValidationError("Only CSV files are supported")

    if len(content) == 0:
        raise DatasetValidationError("Uploaded file is empty")

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise DatasetValidationError(f"File exceeds maximum allowed size of {settings.max_upload_size_mb} MB")

    try:
        df = pd.read_csv(BytesIO(content))
    except (pd.errors.ParserError, pd.errors.EmptyDataError, UnicodeDecodeError) as exc:
        raise DatasetValidationError(f"Could not parse CSV file: {exc}") from exc

    if df.empty or len(df.columns) == 0:
        raise DatasetValidationError("CSV file contains no data")

    return df


def save_dataset(db: Session, project_id: int, upload: UploadFile, content: bytes, df: pd.DataFrame) -> tuple[Dataset, str, int, list[str]]:
    project_dir = Path(settings.upload_dir) / f"project_{project_id}"
    project_dir.mkdir(parents=True, exist_ok=True)

    file_path = project_dir / upload.filename
    file_path.write_bytes(content)

    dataset = Dataset(
        project_id=project_id,
        filename=upload.filename,
        file_path=str(file_path),
        rows=len(df),
        columns=len(df.columns),
        file_size_bytes=len(content),
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    memory = _format_bytes(int(df.memory_usage(deep=True).sum()))
    duplicate_rows = int(df.duplicated().sum())
    target_candidates = _detect_target_candidates(df)

    return dataset, memory, duplicate_rows, target_candidates


def list_datasets(db: Session, project_id: int) -> list[Dataset]:
    return db.query(Dataset).filter(Dataset.project_id == project_id).order_by(Dataset.uploaded_at.desc()).all()


def get_dataset(db: Session, project_id: int, dataset_id: int) -> Dataset | None:
    return db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.project_id == project_id).first()


def set_target(db: Session, dataset: Dataset, target_column: str, problem_type: str) -> Dataset:
    dataset.target_column = target_column
    dataset.problem_type = problem_type
    db.commit()
    db.refresh(dataset)
    return dataset
