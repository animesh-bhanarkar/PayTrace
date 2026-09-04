"""
PayTrace Phase 9: Model Context Protocol (MCP) HTTP Router.

Provides HTTP JSON-RPC 2.0 endpoint for MCP clients.
Endpoints:
  POST /mcp: JSON-RPC 2.0 interface (single or batch)
  GET /mcp: Capabilities, server info, and safety boundary declaration
"""

import json
import logging
from typing import Any, Dict, List, Union
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.mcp_server import (
    MCP_PROTOCOL_VERSION,
    MCP_SERVER_NAME,
    MCP_SERVER_VERSION,
    MCP_TOOL_DEFINITIONS,
    jsonrpc_error,
    process_mcp_request,
)

logger = logging.getLogger("paytrace.routers.mcp")

router = APIRouter(prefix="/mcp", tags=["mcp"])


@router.post("")
@router.post("/")
async def handle_mcp_jsonrpc(request: Request, db: Session = Depends(get_db)):
    """
    HTTP transport endpoint for Model Context Protocol (JSON-RPC 2.0).
    Supports initialization, capability negotiation, tool discovery, and tool invocation.
    Supports single JSON-RPC requests as well as batch request arrays.
    """
    try:
        body_bytes = await request.body()
        if not body_bytes:
            return jsonrpc_error(None, -32600, "Invalid Request: empty request body")
        try:
            req_json = json.loads(body_bytes.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as err:
            return jsonrpc_error(None, -32700, f"Parse error: invalid JSON ({str(err)})")

        # Handle batch requests
        if isinstance(req_json, list):
            if not req_json:
                return jsonrpc_error(None, -32600, "Invalid Request: batch array cannot be empty")
            responses = [process_mcp_request(item, db) for item in req_json]
            return responses

        # Single request
        return process_mcp_request(req_json, db)
    except Exception as exc:
        logger.exception("Unexpected error in /mcp endpoint: %s", exc)
        return jsonrpc_error(None, -32603, f"Internal server error: {str(exc)}")


@router.get("")
@router.get("/")
def get_mcp_server_info():
    """
    Retrieve MCP Server metadata, capabilities, and safety boundary info.
    """
    return {
        "service": MCP_SERVER_NAME,
        "version": MCP_SERVER_VERSION,
        "protocol_version": MCP_PROTOCOL_VERSION,
        "transport": "HTTP (POST /mcp) & STDIO (backend.app.mcp_stdio)",
        "capabilities": {
            "tools": {
                "count": len(MCP_TOOL_DEFINITIONS),
                "listChanged": False,
            },
        },
        "safety_boundary": {
            "financial_mutations_allowed": False,
            "read_only": True,
            "prohibited_operations": [
                "capture",
                "refund",
                "transfer",
                "payout",
                "modify_payment",
                "execute_sql",
                "execute_shell",
            ],
            "authority_model": "Razorpay API/payment state > merchant belief",
        },
        "tools": [
            {"name": t["name"], "description": t["description"]}
            for t in MCP_TOOL_DEFINITIONS
        ],
    }
