from pydantic import BaseModel


class DateFeatureInfo(BaseModel):
    column: str
    derived_columns: list[str]


class InteractionFeatureInfo(BaseModel):
    feature_name: str
    columns: list[str]


class PolynomialFeatureInfo(BaseModel):
    column: str
    feature_name: str


class FrequencyEncodingInfo(BaseModel):
    column: str
    feature_name: str


class TargetEncodingInfo(BaseModel):
    column: str
    feature_name: str


class DroppedFeatureInfo(BaseModel):
    dropped_column: str
    correlated_with: str
    correlation: float


class FeatureEngineeringReport(BaseModel):
    date_features: list[DateFeatureInfo]
    interaction_features: list[InteractionFeatureInfo]
    interaction_features_skipped_reason: str | None = None
    polynomial_features: list[PolynomialFeatureInfo]
    frequency_encoded: list[FrequencyEncodingInfo]
    target_encoded: list[TargetEncodingInfo]
    target_encoding_skipped_reason: str | None = None
    dropped_correlated_features: list[DroppedFeatureInfo]
    feature_count_before: int
    feature_count_after: int
