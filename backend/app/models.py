import datetime
from sqlalchemy import Column, Integer, String, DateTime, JSON
from app.database import Base


class SystemProbe(Base):
    __tablename__ = "system_probes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    probe_name = Column(String(100), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="active")
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
