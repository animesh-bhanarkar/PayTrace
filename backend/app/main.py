import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Any

from app.config import settings
from app.database import get_db, get_engine, check_db_connection, Base
from app.models import SystemProbe, WebhookEvent  # noqa: F401 — ensure all models are registered
from app.routers import webhooks, investigations, scenarios, incidents, search, events, evidence, patterns

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("paytrace")



@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables if DATABASE_URL is configured
    if settings.DATABASE_URL:
        try:
            engine = get_engine()
            Base.metadata.create_all(bind=engine)
            logger.info("Database schema initialized successfully.")
        except Exception as e:
            logger.warning(f"Database initialization deferred: {e}")
    yield


app = FastAPI(
    title="PayTrace API",
    description="Autonomous Payment Incident Investigation Engine",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration supporting deployed Vercel and local origins
raw_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
if not raw_origins or raw_origins == ["*"]:
    allowed_origins = [
        "https://pay-trace-nine.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ]
else:
    allowed_origins = [o for o in raw_origins if o != "*"] or ["https://pay-trace-nine.vercel.app"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhooks.router)
app.include_router(investigations.router)
app.include_router(scenarios.router)
app.include_router(incidents.router)
app.include_router(search.router)
app.include_router(events.router)
app.include_router(evidence.router)
app.include_router(patterns.router)



class ProbeRequest(BaseModel):
    probe_name: str = "supabase_roundtrip_test"
    payload: Optional[dict[str, Any]] = None


@app.get("/")
def root():
    return {
        "service": "PayTrace API",
        "status": "running",
        "version": "0.1.0",
    }


@app.get("/health")
def health():
    db_status = check_db_connection()
    return {
        "status": "ok",
        "service": "paytrace-backend",
        "database": db_status,
        "webhook_secret_configured": bool(settings.RAZORPAY_WEBHOOK_SECRET),
        "allowed_origins": allowed_origins,
    }


@app.post("/db/probe")
def create_and_verify_probe(request: ProbeRequest, db: Session = Depends(get_db)):
    """Create a probe record, persist to Supabase PostgreSQL, and retrieve it."""
    try:
        # Create record
        probe = SystemProbe(
            probe_name=request.probe_name,
            status="verified",
            payload=request.payload or {"source": "render_verification_suite"},
        )
        db.add(probe)
        db.commit()
        db.refresh(probe)

        # Retrieve record to verify persistence roundtrip
        retrieved = db.query(SystemProbe).filter(SystemProbe.id == probe.id).first()
        if not retrieved:
            raise HTTPException(status_code=500, detail="Probe created but could not be retrieved from database")

        return {
            "status": "success",
            "message": "Record successfully persisted and retrieved from Supabase PostgreSQL",
            "record": {
                "id": retrieved.id,
                "probe_name": retrieved.probe_name,
                "status": retrieved.status,
                "payload": retrieved.payload,
                "created_at": retrieved.created_at.isoformat() if retrieved.created_at else None,
            },
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database probe failed: {str(e)}")


@app.get("/db/probes")
def list_probes(limit: int = 10, db: Session = Depends(get_db)):
    """Retrieve recent probe records from Supabase PostgreSQL."""
    try:
        probes = db.query(SystemProbe).order_by(SystemProbe.id.desc()).limit(limit).all()
        return {
            "count": len(probes),
            "probes": [
                {
                    "id": p.id,
                    "probe_name": p.probe_name,
                    "status": p.status,
                    "payload": p.payload,
                    "created_at": p.created_at.isoformat() if p.created_at else None,
                }
                for p in probes
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query database: {str(e)}")
