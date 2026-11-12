from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend import config, google_oauth, mailer
from backend.database.connection import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        database = "ok"
    except Exception:
        database = "error"
    return {"status": "ok" if database == "ok" else "degraded", "version": config.APP_VERSION,
            "database": database, "ai_configured": bool(config.GEMINI_API_KEY),
            "google_configured": google_oauth.is_configured(), "email_configured": mailer.smtp_configured()}
