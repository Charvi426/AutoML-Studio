from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AutoML Studio"
    environment: str = "development"

    database_url: str = "sqlite:///./automl_studio.db"

    secret_key: str = "change-me-in-.env"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    upload_dir: str = "uploads"
    saved_models_dir: str = "saved_models"
    experiments_dir: str = "experiments"
    max_upload_size_mb: int = 100
    mlflow_tracking_uri: str = "sqlite:///mlflow.db"

    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
