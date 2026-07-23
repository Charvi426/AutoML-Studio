from sqlalchemy.orm import Session

from src.database.models import Project


def create_project(db: Session, user_id: int, project_name: str) -> Project:
    project = Project(user_id=user_id, project_name=project_name)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def list_projects(db: Session, user_id: int) -> list[Project]:
    return db.query(Project).filter(Project.user_id == user_id).order_by(Project.created_at.desc()).all()


def get_project(db: Session, user_id: int, project_id: int) -> Project | None:
    return db.query(Project).filter(Project.id == project_id, Project.user_id == user_id).first()
