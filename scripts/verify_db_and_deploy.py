"""
Verification script for Supabase PostgreSQL and Render Backend Deployment.
Tests connectivity, schema creation, record persistence, and retrieval.
"""

import os
import sys
import time
import json
import httpx
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.config import settings
from app.database import get_engine, check_db_connection, Base, get_session_local
from app.models import SystemProbe


def verify_supabase_direct():
    print("=" * 60)
    print("1. SUPABASE POSTGRESQL DIRECT VERIFICATION")
    print("=" * 60)

    if not settings.DATABASE_URL:
        print("[-] DATABASE_URL is not set. Please set DATABASE_URL in .env or environment.")
        return False

    print(f"[*] Database URL: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else 'configured'}")
    
    # 1. Connection check
    print("[*] Testing connection...")
    conn_result = check_db_connection()
    if not conn_result["connected"]:
        print(f"[-] Connection failed: {conn_result['error']}")
        return False
    print(f"[+] Connection successful! Ping latency: {conn_result['latency_ms']} ms")

    # 2. Schema initialization
    print("[*] Initializing table metadata (Base.metadata.create_all)...")
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    print("[+] Table 'system_probes' ensured in Supabase PostgreSQL.")

    # 3. Persist and retrieve test record
    print("[*] Persisting test record...")
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        test_payload = {
            "test_type": "day1_supabase_verification",
            "timestamp": time.time(),
            "client": "paytrace_verification_suite",
        }
        probe = SystemProbe(
            probe_name="direct_supabase_verification",
            status="verified",
            payload=test_payload,
        )
        db.add(probe)
        db.commit()
        db.refresh(probe)
        print(f"[+] Record inserted with ID: {probe.id}")

        # Retrieve record
        print(f"[*] Retrieving record with ID {probe.id}...")
        retrieved = db.query(SystemProbe).filter(SystemProbe.id == probe.id).first()
        if not retrieved or retrieved.probe_name != "direct_supabase_verification":
            print("[-] Retrieval validation failed!")
            return False
        
        print(f"[+] Successfully retrieved record: ID={retrieved.id}, Status={retrieved.status}, CreatedAt={retrieved.created_at}")
        return True
    except Exception as e:
        db.rollback()
        print(f"[-] Error during record persistence: {e}")
        return False
    finally:
        db.close()


def verify_deployed_render(base_url: str):
    print("\n" + "=" * 60)
    print("2. RENDER DEPLOYED BACKEND VERIFICATION")
    print(f"Target URL: {base_url}")
    print("=" * 60)

    clean_url = base_url.rstrip("/")

    # 1. Cold start / Health check
    print("[*] Sending initial request to /health (measuring cold start latency)...")
    start_time = time.perf_counter()
    try:
        resp = httpx.get(f"{clean_url}/health", timeout=60.0)
        elapsed = (time.perf_counter() - start_time) * 1000
        print(f"[+] Response status: {resp.status_code} in {elapsed:.2f} ms")
        print(f"[+] Health payload: {resp.text}")
        if resp.status_code != 200:
            print("[-] Health endpoint returned non-200 status code.")
            return False
    except Exception as e:
        print(f"[-] Failed to reach Render endpoint: {e}")
        return False

    # 2. Persist probe via deployed endpoint
    print("\n[*] Sending POST to /db/probe on deployed Render instance...")
    try:
        probe_data = {
            "probe_name": "render_live_deployment_verification",
            "payload": {
                "verified_via": "render_https",
                "timestamp": time.time(),
            },
        }
        probe_resp = httpx.post(f"{clean_url}/db/probe", json=probe_data, timeout=30.0)
        print(f"[+] Probe response status: {probe_resp.status_code}")
        print(f"[+] Response body: {probe_resp.text}")
        if probe_resp.status_code != 200:
            print("[-] Deployed probe creation failed.")
            return False
    except Exception as e:
        print(f"[-] Probe request failed: {e}")
        return False

    # 3. Retrieve probes via deployed endpoint
    print("\n[*] Sending GET to /db/probes on deployed Render instance...")
    try:
        list_resp = httpx.get(f"{clean_url}/db/probes?limit=5", timeout=30.0)
        print(f"[+] Probes list status: {list_resp.status_code}")
        print(f"[+] Probes retrieved: {list_resp.text}")
        if list_resp.status_code == 200:
            print("\n[+] FULL DEPLOYMENT & DATABASE ROUNDTRIP VERIFIED!")
            return True
        return False
    except Exception as e:
        print(f"[-] List probes request failed: {e}")
        return False


if __name__ == "__main__":
    render_url = sys.argv[1] if len(sys.argv) > 1 else os.getenv("RENDER_BACKEND_URL", "")
    direct_ok = verify_supabase_direct()
    
    if render_url:
        verify_deployed_render(render_url)
    else:
        print("\n[*] No Render URL provided. Pass as argument: python scripts/verify_db_and_deploy.py <RENDER_URL>")
