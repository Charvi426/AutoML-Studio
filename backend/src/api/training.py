import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.api.deps import get_owned_dataset, require_target
from src.database.models import Dataset, TrainingRun
from src.database.session import get_db
from src.models.saved_model import SavedModelOut
from src.models.training import ModelResultOut, TrainingRunOut, TrainingRunSummary
from src.services import saved_model_service, training_service

router = APIRouter(prefix="/api/projects/{project_id}/datasets/{dataset_id}", tags=["training"])


def _to_training_run_out(training_run: TrainingRun) -> TrainingRunOut:
    return TrainingRunOut(
        id=training_run.id,
        target_column=training_run.target_column,
        problem_type=training_run.problem_type,
        class_labels=json.loads(training_run.class_labels_json) if training_run.class_labels_json else None,
        created_at=training_run.created_at,
        model_results=[ModelResultOut.model_validate(mr) for mr in training_run.model_results],
        best_model_name=training_service.get_best_model_name(training_run),
    )


@router.post("/train", response_model=TrainingRunOut, status_code=status.HTTP_201_CREATED)
def train_models(dataset: Dataset = Depends(get_owned_dataset), db: Session = Depends(get_db)):
    require_target(dataset)
    training_run = training_service.run_training(db, dataset)
    return _to_training_run_out(training_run)


@router.get("/training-runs", response_model=list[TrainingRunSummary])
def list_training_runs(dataset: Dataset = Depends(get_owned_dataset), db: Session = Depends(get_db)):
    runs = training_service.list_training_runs(db, dataset.id)
    return [
        TrainingRunSummary(
            id=run.id,
            target_column=run.target_column,
            problem_type=run.problem_type,
            created_at=run.created_at,
            model_count=len(run.model_results),
            best_model_name=training_service.get_best_model_name(run),
        )
        for run in runs
    ]


@router.get("/training-runs/{run_id}", response_model=TrainingRunOut)
def get_training_run(run_id: int, dataset: Dataset = Depends(get_owned_dataset), db: Session = Depends(get_db)):
    training_run = training_service.get_training_run(db, dataset.id, run_id)
    if training_run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training run not found")
    return _to_training_run_out(training_run)


@router.post("/training-runs/{run_id}/models/{model_name}/save", response_model=SavedModelOut)
def save_model(
    run_id: int,
    model_name: str,
    dataset: Dataset = Depends(get_owned_dataset),
    db: Session = Depends(get_db),
):
    training_run = training_service.get_training_run(db, dataset.id, run_id)
    if training_run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training run not found")
    model_result = training_service.get_model_result(training_run, model_name)
    if model_result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found in this training run")

    saved = saved_model_service.save_model(db, dataset.project, dataset, training_run, model_result)
    return SavedModelOut(**saved_model_service.to_out_dict(saved))
