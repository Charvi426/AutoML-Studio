import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.api.deps import get_current_user, get_owned_project
from src.database.models import Project, User
from src.database.session import get_db
from src.models.prediction import PredictionHistoryEntry, PredictionResult, PredictionStats
from src.models.saved_model import SavedModelOut
from src.services import dataset_service, prediction_service, saved_model_service

router = APIRouter(prefix="/api/projects/{project_id}", tags=["predictions"])


def _get_saved_model_or_400(db: Session, project_id: int):
    saved = saved_model_service.get_saved_model(db, project_id)
    if saved is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No saved model for this project yet. Save one first via .../models/{model_name}/save",
        )
    return saved


@router.get("/saved-model", response_model=SavedModelOut)
def get_saved_model_info(project: Project = Depends(get_owned_project), db: Session = Depends(get_db)):
    saved = saved_model_service.get_saved_model(db, project.id)
    if saved is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No saved model for this project yet")
    return SavedModelOut(**saved_model_service.to_out_dict(saved))


@router.post("/predict", response_model=PredictionResult)
def predict(
    payload: dict,
    project: Project = Depends(get_owned_project),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    saved = _get_saved_model_or_400(db, project.id)
    result = prediction_service.predict_single(saved, payload)
    prediction_service.log_prediction(
        db, project.id, current_user.id, saved.model_name, "single", 1, result["probability"]
    )
    return PredictionResult(**result)


@router.post("/predict/batch")
async def predict_batch(
    file: UploadFile = File(...),
    project: Project = Depends(get_owned_project),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    saved = _get_saved_model_or_400(db, project.id)

    content = await file.read()
    df = dataset_service.validate_and_parse_csv(file.filename, content)

    result_df, avg_confidence = prediction_service.predict_batch(saved, df)
    prediction_service.log_prediction(
        db, project.id, current_user.id, saved.model_name, "batch", len(result_df), avg_confidence
    )

    stream = io.StringIO()
    result_df.to_csv(stream, index=False)
    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=predictions.csv"},
    )


@router.get("/predictions/history", response_model=list[PredictionHistoryEntry])
def get_prediction_history(project: Project = Depends(get_owned_project), db: Session = Depends(get_db)):
    records = prediction_service.get_history(db, project.id)
    return [PredictionHistoryEntry.model_validate(r) for r in records]


@router.get("/predictions/stats", response_model=PredictionStats)
def get_prediction_stats(project: Project = Depends(get_owned_project), db: Session = Depends(get_db)):
    return prediction_service.get_stats(db, project.id)
