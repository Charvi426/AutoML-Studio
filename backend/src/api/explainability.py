from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.api.deps import get_owned_dataset
from src.database.models import Dataset
from src.database.session import get_db
from src.models.explainability import ShapInstanceExplanation, ShapSummary
from src.services import explainability_service, training_service

router = APIRouter(
    prefix="/api/projects/{project_id}/datasets/{dataset_id}/training-runs/{run_id}/models/{model_name}/explain",
    tags=["explainability"],
)


def _get_run_and_model(db: Session, dataset: Dataset, run_id: int, model_name: str):
    training_run = training_service.get_training_run(db, dataset.id, run_id)
    if training_run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training run not found")
    model_result = training_service.get_model_result(training_run, model_name)
    if model_result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found in this training run")
    return training_run, model_result


@router.get("/summary", response_model=ShapSummary)
def get_shap_summary(
    run_id: int,
    model_name: str,
    dataset: Dataset = Depends(get_owned_dataset),
    db: Session = Depends(get_db),
):
    training_run, model_result = _get_run_and_model(db, dataset, run_id, model_name)
    return explainability_service.get_summary(dataset, training_run, model_result)


@router.get("/instance/{row_index}", response_model=ShapInstanceExplanation)
def get_shap_instance(
    run_id: int,
    model_name: str,
    row_index: int,
    dataset: Dataset = Depends(get_owned_dataset),
    db: Session = Depends(get_db),
):
    training_run, model_result = _get_run_and_model(db, dataset, run_id, model_name)
    try:
        return explainability_service.get_instance_explanation(dataset, training_run, model_result, row_index)
    except explainability_service.ExplainabilityError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
