import time
from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import settings

Base = declarative_base()

_engine = None
_SessionLocal = None


def upgrade_schema(engine):
    """
    Idempotent schema upgrade ensuring Phase 6 operational columns exist.
    Safe for both PostgreSQL (Supabase) and SQLite.
    """
    if engine is None:
        return
    dialect = engine.dialect.name
    if dialect == "postgresql":
        statements = [
            "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;",
            "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS operational_status VARCHAR(50) NOT NULL DEFAULT 'OPEN';",
            "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM';",
            "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;",
            "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS assignee VARCHAR(255);",
            "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS workflow_history JSONB DEFAULT '[]'::jsonb;",
            "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS trust_status VARCHAR(20) NOT NULL DEFAULT 'UNTRUSTED';",
            "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS duplicate_status VARCHAR(20) NOT NULL DEFAULT 'ORIGINAL';",
            "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS delivery_delay_seconds DOUBLE PRECISION;",
            "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS order_id VARCHAR(255);",
            "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS payment_id VARCHAR(255);",
            "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS payload_hash VARCHAR(64);",
            "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS payload_size_bytes INTEGER;",
            "ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS error_details JSONB;",
        ]
        try:
            with engine.connect() as conn:
                for stmt in statements:
                    conn.execute(text(stmt))
                conn.commit()
        except Exception:
            pass
    elif dialect == "sqlite":
        try:
            with engine.connect() as conn:
                cols = [row[1] for row in conn.execute(text("PRAGMA table_info(incidents);")).fetchall()]
                if cols:
                    if "resolved_at" not in cols:
                        conn.execute(text("ALTER TABLE incidents ADD COLUMN resolved_at DATETIME;"))
                    if "operational_status" not in cols:
                        conn.execute(text("ALTER TABLE incidents ADD COLUMN operational_status VARCHAR(50) DEFAULT 'OPEN';"))
                    if "priority" not in cols:
                        conn.execute(text("ALTER TABLE incidents ADD COLUMN priority VARCHAR(20) DEFAULT 'MEDIUM';"))
                    if "tags" not in cols:
                        conn.execute(text("ALTER TABLE incidents ADD COLUMN tags JSON DEFAULT '[]';"))
                    if "assignee" not in cols:
                        conn.execute(text("ALTER TABLE incidents ADD COLUMN assignee VARCHAR(255);"))
                    if "workflow_history" not in cols:
                        conn.execute(text("ALTER TABLE incidents ADD COLUMN workflow_history JSON DEFAULT '[]';"))

                wh_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(webhook_events);")).fetchall()]
                if wh_cols:
                    if "trust_status" not in wh_cols:
                        conn.execute(text("ALTER TABLE webhook_events ADD COLUMN trust_status VARCHAR(20) DEFAULT 'UNTRUSTED';"))
                    if "duplicate_status" not in wh_cols:
                        conn.execute(text("ALTER TABLE webhook_events ADD COLUMN duplicate_status VARCHAR(20) DEFAULT 'ORIGINAL';"))
                    if "delivery_delay_seconds" not in wh_cols:
                        conn.execute(text("ALTER TABLE webhook_events ADD COLUMN delivery_delay_seconds FLOAT;"))
                    if "order_id" not in wh_cols:
                        conn.execute(text("ALTER TABLE webhook_events ADD COLUMN order_id VARCHAR(255);"))
                    if "payment_id" not in wh_cols:
                        conn.execute(text("ALTER TABLE webhook_events ADD COLUMN payment_id VARCHAR(255);"))
                    if "payload_hash" not in wh_cols:
                        conn.execute(text("ALTER TABLE webhook_events ADD COLUMN payload_hash VARCHAR(64);"))
                    if "payload_size_bytes" not in wh_cols:
                        conn.execute(text("ALTER TABLE webhook_events ADD COLUMN payload_size_bytes INTEGER;"))
                    if "error_details" not in wh_cols:
                        conn.execute(text("ALTER TABLE webhook_events ADD COLUMN error_details JSON;"))
                conn.commit()
        except Exception:
            pass


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
        upgrade_schema(_engine)
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
