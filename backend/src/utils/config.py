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

    # Plain comma-separated string rather than a list — pydantic-settings tries to
    # JSON-parse env vars for list-typed fields, which is error-prone to type
    # correctly into a plain-text dashboard field on most hosting platforms.
    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
