# AutoML Studio

A web platform for uploading tabular datasets, exploring and auto-preprocessing them, training multiple ML models, comparing results, explaining predictions with SHAP, and deploying the best model through an API.

## Architecture

```
                User
                  |
         React Frontend
                  |
          FastAPI Backend
                  |
     +------------+------------+
     |            |            |
 Training     Prediction    Database
 Pipeline      Pipeline
     |            |
  MLflow      Saved Models
     |
   Models (.pkl)
```

## Project structure

```
AutoML/
  frontend/            React + TypeScript (Vite)
  backend/
    src/
      api/             FastAPI routers
      services/        Business logic
      ml/              Preprocessing, training, SHAP
      database/        SQLAlchemy models/session
      utils/           Config, helpers
      models/          Pydantic schemas
    tests/
    uploads/           Uploaded datasets (gitignored)
    saved_models/       Trained model artifacts (gitignored)
    experiments/        MLflow tracking data (gitignored)
    requirements.txt
```

## Getting started

### Backend

```
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env
uvicorn src.main:app --reload
```

Backend runs at http://localhost:8000 — health check at `/health`, interactive docs at `/docs`.

### Frontend

```
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173.

## Roadmap

1. Project setup
2. User authentication (JWT)
3. Project management
4. Dataset upload
5. Automatic data profiling (EDA)
6. Target column selection
7. ML problem detection (classification/regression)
8. Data cleaning pipeline
9. Feature engineering
10. Model training (Logistic Regression, Random Forest, XGBoost, LightGBM, CatBoost)
11. MLflow experiment tracking
12. Model comparison dashboard
13. SHAP explainability
14. Save best model
15. Prediction API
16. Batch prediction
17. Prediction history
18. Frontend dashboard
19. Deployment
