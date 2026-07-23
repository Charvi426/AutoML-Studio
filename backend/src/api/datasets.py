from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from src.api.deps import get_owned_dataset, get_owned_project, require_target
from src.database.models import Dataset, Project
from src.database.session import get_db
from src.models.dataset import DatasetOut, DatasetUploadResult
from src.models.feature_engineering import FeatureEngineeringReport
from src.models.preprocessing import PreprocessingReport
from src.models.profile import DatasetProfile
from src.models.target import TargetSelection, TargetSelectionResult
from src.services import dataset_service, feature_engineering_service, preprocessing_service, profiling_service, target_service

router = APIRouter(prefix="/api/projects/{project_id}/datasets", tags=["datasets"])


@router.post("", response_model=DatasetUploadResult, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    file: UploadFile = File(...),
    project: Project = Depends(get_owned_project),
    db: Session = Depends(get_db),
):
    content = await file.read()
    df = dataset_service.validate_and_parse_csv(file.filename, content)
    dataset, memory, duplicate_rows, target_candidates = dataset_service.save_dataset(
        db, project.id, file, content, df
    )
    return DatasetUploadResult(
        id=dataset.id,
        filename=dataset.filename,
        rows=dataset.rows,
        columns=dataset.columns,
        uploaded_at=dataset.uploaded_at,
        memory=memory,
        duplicate_rows=duplicate_rows,
        target_candidates=target_candidates,
    )


@router.get("", response_model=list[DatasetOut])
def list_datasets(project: Project = Depends(get_owned_project), db: Session = Depends(get_db)):
    return dataset_service.list_datasets(db, project.id)


@router.get("/{dataset_id}/profile", response_model=DatasetProfile)
def get_dataset_profile(dataset: Dataset = Depends(get_owned_dataset)):
    return profiling_service.generate_profile(dataset.file_path)


@router.put("/{dataset_id}/target", response_model=TargetSelectionResult)
def set_target_column(
    payload: TargetSelection,
    dataset: Dataset = Depends(get_owned_dataset),
    db: Session = Depends(get_db),
):
    analysis = target_service.analyze_target(dataset.file_path, payload.target_column)
    dataset_service.set_target(db, dataset, payload.target_column, analysis["problem_type"])
    return TargetSelectionResult(
        target_column=payload.target_column,
        problem_type=analysis["problem_type"],
        class_distribution=analysis["class_distribution"],
        regression_summary=analysis["regression_summary"],
    )


@router.post("/{dataset_id}/preprocess", response_model=PreprocessingReport)
def preprocess_dataset(dataset: Dataset = Depends(get_owned_dataset)):
    require_target(dataset)
    return preprocessing_service.build_preprocessing_report(dataset.file_path, dataset.target_column, dataset.problem_type)


@router.post("/{dataset_id}/feature-engineering", response_model=FeatureEngineeringReport)
def engineer_features(dataset: Dataset = Depends(get_owned_dataset)):
    require_target(dataset)
    return feature_engineering_service.build_feature_engineering_report(
        dataset.file_path, dataset.target_column, dataset.problem_type
    )
