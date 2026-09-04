"""
PayTrace MCP Safety Boundary.

Architecture safety rule:
PayTrace's investigation/intelligence layer must NEVER receive access to
money-moving or financial-mutating MCP operations.

Prohibited AI-accessible operations include:
- capture
- refund
- payment modification
- payout
- transfer
- payment-link mutation
- checkout/configuration mutation
- any other financial or externally consequential mutation
- arbitrary database/SQL/shell/filesystem execution

MCP access for investigation is strictly read-only and evidence-oriented.
Allowed tools are a controlled interface over existing PayTrace services.
"""

from typing import Set, Tuple, Optional

# Strictly prohibited operation identifiers / keywords / prefixes
PROHIBITED_MCP_OPERATIONS: Tuple[str, ...] = (
    # Financial mutations
    "capture",
    "refund",
    "modify_payment",
    "update_payment",
    "payout",
    "transfer",
    "create_payment_link",
    "update_payment_link",
    "cancel_payment_link",
    "modify_checkout",
    "update_checkout_config",
    "void_payment",
    "chargeback_action",
    "reversal",
    # Arbitrary execution / system access
    "execute_sql",
    "execute_query",
    "raw_sql",
    "execute_shell",
    "run_command",
    "eval_code",
    "file_write",
    "file_delete",
)

# Approved read-only and evidence-oriented tools
ALLOWED_MCP_TOOLS: Set[str] = {
    "get_incident",
    "get_incident_evidence",
    "get_webhook_diagnostics",
    "get_investigation",
    "get_investigation_history",
    "search_incidents",
    "get_similar_incidents",
    "get_patterns",
    "run_advanced_investigation",
}


class MCPSafetyViolationError(PermissionError):
    """Raised when an MCP operation violates the PayTrace safety boundary."""
    pass


def validate_mcp_tool_safety(tool_name: str) -> bool:
    """
    Validate that an MCP tool adheres to the PayTrace safety boundary.

    Raises:
        MCPSafetyViolationError if the tool is prohibited, attempts financial
        mutation, or is outside the approved evidence-oriented tools.

    Returns:
        True if the tool is strictly compliant and approved.
    """
    normalized = tool_name.strip().lower()

    # 1. Check against prohibited patterns
    for prohibited in PROHIBITED_MCP_OPERATIONS:
        if prohibited in normalized:
            raise MCPSafetyViolationError(
                f"MCP Safety Violation: Operation '{tool_name}' involves financial mutation or "
                f"arbitrary system access ('{prohibited}'). PayTrace investigation layer must NEVER "
                f"receive access to money-moving or financial-mutating operations."
            )

    # 2. Check whitelist of allowed tools
    if normalized not in ALLOWED_MCP_TOOLS:
        raise MCPSafetyViolationError(
            f"MCP Safety Violation: Tool '{tool_name}' is not in the approved read-only/evidence-oriented "
            f"MCP tool whitelist: {sorted(ALLOWED_MCP_TOOLS)}"
        )

    return True


def is_safe_mcp_tool(tool_name: str) -> bool:
    """Non-raising predicate to verify if an MCP tool name is permitted."""
    try:
        return validate_mcp_tool_safety(tool_name)
    except MCPSafetyViolationError:
        return False
