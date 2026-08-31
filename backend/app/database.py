import time
from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import settings

Base = declarative_base()

_engine = None
_SessionLocal = None


def get_engine():
    global _engine, _SessionLocal
    if _engine is None:
        db_url = settings.sqlalchemy_database_uri
        if not db_url:
            raise ValueError("DATABASE_URL environment variable is not configured.")
        
        _engine = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_recycle=300,
        )
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _engine


def get_session_local():
    global _SessionLocal
    if _SessionLocal is None:
        get_engine()
    return _SessionLocal


def get_db() -> Generator[Session, None, None]:
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> dict:
    """Validate active database connectivity and measure latency."""
    if not settings.DATABASE_URL:
        return {
            "connected": False,
            "error": "DATABASE_URL environment variable not configured",
            "latency_ms": None,
        }
    
    start_time = time.perf_counter()
    try:
        engine = get_engine()
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).scalar()
            latency = (time.perf_counter() - start_time) * 1000
            return {
                "connected": result == 1,
                "latency_ms": round(latency, 2),
                "error": None,
            }
    except Exception as e:
        latency = (time.perf_counter() - start_time) * 1000
        return {
            "connected": False,
            "latency_ms": round(latency, 2),
            "error": str(e),
        }
