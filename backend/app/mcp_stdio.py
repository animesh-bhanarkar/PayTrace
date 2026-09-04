"""
PayTrace Phase 9: Model Context Protocol (MCP) STDIO Runner.

Enables local AI hosts (e.g. Claude Desktop, local agents) to communicate
with PayTrace via standard input/output.

CRITICAL STDIO INVARIANTS:
1. Standard protocol messages (JSON-RPC 2.0) are written exclusively to STDOUT.
2. All diagnostics, application logs, and warnings are written exclusively to STDERR.
3. STDOUT must remain strictly machine-readable line-delimited JSON.
"""

import json
import logging
import sys

# Configure root logger to output exclusively to STDERR
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [paytrace-stdio] %(message)s",
)
logger = logging.getLogger("paytrace.mcp.stdio")


def run_stdio_server():
    """
    Main loop for stdio MCP transport.
    Reads line-by-line JSON-RPC messages from stdin, processes them,
    and writes responses to stdout.
    """
    from app.mcp_server import process_mcp_request, jsonrpc_error

    logger.info("PayTrace MCP STDIO server started. Waiting for JSON-RPC messages on stdin...")

    for line in sys.stdin:
        clean_line = line.strip()
        if not clean_line:
            continue

        try:
            req_data = json.loads(clean_line)
        except json.JSONDecodeError as exc:
            err_resp = jsonrpc_error(None, -32700, f"Parse error: {str(exc)}")
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()
            continue

        try:
            # Process request
            resp_data = process_mcp_request(req_data)
            sys.stdout.write(json.dumps(resp_data) + "\n")
            sys.stdout.flush()
        except Exception as exc:
            logger.exception("Error processing MCP stdio request: %s", exc)
            err_resp = jsonrpc_error(
                req_data.get("id") if isinstance(req_data, dict) else None,
                -32603,
                f"Internal server error: {str(exc)}",
            )
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    run_stdio_server()
