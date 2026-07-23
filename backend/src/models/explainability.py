from pydantic import BaseModel


class FeatureImportance(BaseModel):
    feature: str
    mean_abs_shap: float


class ShapSummary(BaseModel):
    model_name: str
    feature_importance: list[FeatureImportance]


class FeatureContribution(BaseModel):
    feature: str
    value: float
    shap_value: float


class ShapInstanceExplanation(BaseModel):
    model_name: str
    row_index: int
    predicted_class: str | None = None
    explained_class: str | None = None
    base_value: float
    predicted_value: float
    contributions: list[FeatureContribution]
