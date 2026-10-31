# COFRAME — Functional vs. Simulated Disclosure Matrix

Per the BIOS FORGE Hackathon rules, this matrix transparently details the implementation reality of every major system capability within COFRAME, distinguishing fully functional production logic from demo simplifications or fallbacks.

---

## 1. Capability Matrix

| System Capability | Implementation Reality | Functional vs. Simulated Disclosure | Verification / Proof |
| :--- | :--- | :--- | :--- |
| **Two Human Sessions (Alex & Maya)** | **Functional Demo Identity Model with Realtime Presence** | **Demo Identity Mechanism:** Users select "Alex" or "Maya" from an identity switcher without requiring username/password or JWT authentication to facilitate rapid hackathon judging and multi-browser evaluation. Presence tracking is **100% Functional** via active WebSockets. | Open Alex in normal browser and Maya in incognito window. Both topbars show active collaborator status with live avatar indicators. |
| **Server-Side Role & Decision Permissions** | **Functional Server-Side Policy Enforcement** | **100% Functional:** The backend strictly verifies caller identity. High-impact proposals (`requires_decision=True`, `assigned_decider_id="alex"`) return HTTP 403 Forbidden if Maya attempts to approve, reject, or redirect them. | Verified by `backend/tests/test_concurrency_and_redirect.py::test_decision_permissions_alex_vs_maya` and Playwright Step 6. |
| **Realtime Presence & Synchronization** | **Functional Realtime WebSocket Engine** | **100% Functional:** FastAPI WebSockets (`/ws/{project_id}/{identity_key}`) broadcast events, requirement edits, section updates, and collaborator presence to all connected tabs without polling. | Edit a requirement in Alex's window; Maya's window updates context version and displays notifications instantly. |
| **NOVA (Product Strategist Agent)** | **Functional Multi-Provider Adapter + Deterministic Fallback** | **Hybrid / Transparently Labeled:** Calls live LLMs (Gemini, OpenAI, Claude, OpenRouter) with strict JSON schema parsing. When external keys are absent or rate-limited, safely uses deterministic fixture fallbacks stamped with `source="cached_fallback"` and a visible `SIMULATED FALLBACK` UI badge. | Proposals display live vs fallback origin badges on the card and in the Context Inspector JSON view. |
| **PIXEL (Prototype Engineer Agent)** | **Functional Multi-Provider Adapter + Deterministic Fallback** | **Hybrid / Transparently Labeled:** Generates structured JSON operations (`set_hero_content`, `set_dashboard_metrics`, `set_approval_queue_config`). Never runs arbitrary code. Displays `SIMULATED FALLBACK` badge when running offline. | Validated against Pydantic schema; rendered safely by fixed React renderer. |
| **Authoritative Context Pack** | **Functional Persisted Backend Pack** | **100% Functional:** Built from database state (active requirements, decisions, section versions, recent event log). Stored immutably on `agent_runs.context_pack`. | Inspectable in the Context Inspector tab. Full JSON payload visible with exact versions. |
| **Selective Staleness** | **Functional Set-Intersection Engine** | **100% Functional:** Evaluates `changed_requirement_keys ∩ proposal.affected_requirements`. Proposal A (Audience) becomes STALE when `REQ_AUDIENCE` changes; Proposal B (Metrics) remains PENDING and eligible for review. | Proved by `backend/tests/test_backend.py::test_selective_staleness` and automated E2E Step 4. |
| **Section Conflict Detection** | **Functional Compare-and-Swap Version Check** | **100% Functional:** Compares proposal `base_section_versions` against current database section versions. When Maya manually edits a section, its version increments, marking older pending proposals as CONFLICT. | Manual Hero Edit increments hero from v1 to v2; PIXEL Proposal C automatically displays CONFLICT badge with side-by-side diff. |
| **Atomic Apply Engine & Transaction Safety** | **Functional ACID Transaction with CAS Updates** | **100% Functional:** Database transaction executes compare-and-swap updates (`UPDATE ... WHERE version = expected`). Event logging uses transaction-bound flushes (`auto_commit=False`). Section updates, project artifact version, proposal status, decision records, and audit events commit together or roll back completely on failure. | Proved by `backend/tests/test_concurrency_and_redirect.py` (competing edits, apply conflicts, multi-section rollback). |
| **Dual Agent Redirect Engine** | **Functional Lineage Tracking & Regeneration** | **100% Functional:** Both NOVA and PIXEL support human redirects. Captures human instruction, generates a fresh Context Pack, invokes the originating agent, and links the new proposal via `supersedes_proposal_id`. | Tested in `backend/tests/test_concurrency_and_redirect.py::test_redirect_nova_and_pixel_preserves_supersedes_relationship`. |
| **Agent Restart & Recovery** | **Functional Database State Recovery** | **100% Functional:** Rebuilds fresh Context Pack from SQLite/PostgreSQL persisted state, calculates offline missed events, and persists an authentic recovery summary (not hardcoded text). | Context Inspector shows new run ID, reconstructed requirements, and recovery event log. |
| **Observer Summary** | **Functional Synthesis with Rule-Based Fallback** | **Hybrid:** Uses live LLM synthesis or robust rule-based event summarizer to answer What Changed, Why, and What Happens Next with exact event sequence citations. | Visible under TopBar across all tabs; updates automatically on every event broadcast. |
| **Trusted Prototype Renderer** | **Functional Fixed React Component Suite** | **100% Functional:** Fixed, secure React components (`LedgerFlowHero`, `LedgerFlowMetricGrid`, `LedgerFlowApprovalQueue`) render approved JSON. No `eval()`, dynamic scripts, or unvetted code execution. | Live interactive rendering on the Product Canvas tab. |
| **Deterministic Demo Reset** | **Functional Seed Database Reset** | **100% Functional:** `POST /api/demo/reset` wipes and restores baseline requirements, LedgerFlow sections, versions, and events to Step 0 state. | 1-click Reset Demo button in TopBar. |

---

## 2. Authentication Disclaimer
COFRAME's target in the 24-hour BIOS FORGE Hackathon scope is the multi-collaborator product creation engine. To allow evaluators and teammates to immediately switch roles or open side-by-side browser windows without creating email accounts or managing session cookies:
- An **Identity Switcher** is used on the frontend to select whether the current tab acts as **Alex** (Decision Owner) or **Maya** (Product Designer).
- The backend enforces role validation based on the supplied identity: restricted actions (such as approving or redirecting high-impact approval policies) require `alex`. Requests from unauthorized identities are rejected with `HTTP 403 Forbidden` or `HTTP 400 Bad Request`.
- This is a documented **demo identity mechanism**, not enterprise multi-tenant authentication.

---

## 3. Concurrency & Transaction Guarantees
- **Compare-and-Swap (CAS):** All writes to section content and project versions verify that `version == expected_version`. If a concurrent writer has updated the row in the interim, rowcount check fails and the entire transaction aborts.
- **Unified Atomic Commit:** Section updates, project version increments, proposal state transitions, decision audit records, and event log entries are committed within a single database transaction block.
- **Rollback Guarantee:** If any section fails a version check, or if a permission check fails, all modifications in the transaction are rolled back cleanly via `db.rollback()`.
- **Isolated Conflict Recording:** When an apply attempt fails due to stale context or version conflict, the failure status is recorded in a separate, isolated transaction so audit history is preserved without corrupting artifact state.

---

## 4. Test Verification Summary
All capabilities listed above are backed by automated tests:
- **Pytest Suite:** 17 unit and integration tests passing (`backend/tests/test_backend.py`, `backend/tests/test_api_endpoints.py`, `backend/tests/test_concurrency_and_redirect.py`).
- **Playwright E2E Suite:** Full 11-stage, two-browser session test (`backend/tests/test_playwright_e2e.py`) executing all 7 demo steps via actual DOM clicks, form fills, and modal interactions.
- **Verification Runner:** `scripts/verify.ps1` runs dependency checks, frontend build, backend health verification, Pytest, and headless Playwright in an automated pipeline.

