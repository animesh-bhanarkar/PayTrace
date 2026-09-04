# PayTrace MCP Safety Boundary

## 1. Architectural Safety Rule

**PayTrace's investigation and intelligence layer must NEVER receive access to money-moving or financial-mutating operations.**

Phase 9 introduces Model Context Protocol (MCP) tooling and live monitoring. This document formally establishes the architectural safety boundaries that govern all MCP tools exposed by PayTrace.

---

## 2. Prohibited AI-Accessible Operations

Under no circumstances may any AI model, investigation agent, or MCP tool expose or invoke financial-mutating or externally consequential operations:

* **No Payment Capture:** `capture` or automatic settlement.
* **No Refunds / Reversals:** `refund`, `reversal`, or chargeback actions.
* **No Payment Modification:** `modify_payment`, `update_payment`, or voiding.
* **No Payouts or Transfers:** `payout`, `transfer`, or fund movements.
* **No Payment-Link Mutations:** `create_payment_link`, `update_payment_link`, or `cancel_payment_link`.
* **No Checkout Mutations:** `modify_checkout` or checkout configuration changes.
* **No Arbitrary System Access:** No `execute_sql`, `execute_shell`, `run_command`, `eval_code`, or arbitrary filesystem mutations.

---

## 3. Allowed MCP Capabilities (Read-Only & Evidence-Oriented)

MCP access for investigation is strictly read-only and evidence-oriented:

| Allowed Tool | Capability Description |
|---|---|
| `get_incident` | Retrieve incident record and anomaly details |
| `get_incident_evidence` | Inspect structured evidence package with trust labels |
| `get_webhook_diagnostics` | Inspect delivery delays, out-of-order anomalies, and reconciliation |
| `get_investigation` | Fetch existing deterministic investigation result |
| `get_investigation_history` | Retrieve chronological audit trail of past investigations |
| `search_incidents` | Query incidents by filter criteria |
| `get_similar_incidents` | Query historical incident similarity and fingerprint matches |
| `get_patterns` | Inspect cross-incident patterns and clusters |
| `run_advanced_investigation` | Trigger advanced investigation through existing pipeline |

---

## 4. Single Business-Logic Implementation

PayTrace does **NOT** create a second business-logic implementation for MCP:

1. MCP tools are thin, controlled interfaces directly calling existing PayTrace services (`investigations.py`, `webhook_diagnostics.py`, `pattern_detector.py`, etc.).
2. When `run_advanced_investigation` is invoked via MCP:
   - It executes through the exact same deterministic AI activation gate.
   - It maintains evidence trust labels (`AUTHORITATIVE`, `VERIFIED`, `DETERMINISTIC`, `HISTORICAL_CONTEXT`, `PATTERN_CONTEXT`).
   - It runs the 5-verdict claim verifier (`VERIFIED`, `PARTIALLY_VERIFIED`, `UNSUPPORTED`, `CONTRADICTED`, `UNVERIFIABLE`).
   - It applies the deterministic confidence engine and explicit abstention.
   - It writes an immutable record to the `AuditRecord` table.
   - It never mutates financial or payment state.

---

## 5. Enforcement Mechanism

The boundary is programmatic and validated by `backend/app/mcp_safety.py`:
- `validate_mcp_tool_safety(tool_name)` validates every tool call against `PROHIBITED_MCP_OPERATIONS` and ensures it belongs to `ALLOWED_MCP_TOOLS`.
- Violations raise `MCPSafetyViolationError` and abort execution immediately.
