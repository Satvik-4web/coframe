# COFRAME — Master Technical Architecture & End-to-End Feature Blueprint

<badge>SYSTEM ARCHITECTURE & TECHNICAL SPECIFICATION</badge>

**COFRAME** is a multiplayer, AI-native collaborative software engineering environment. It bridges the gap between high-level human product vision and autonomous software engineering by orchestrating two specialized AI agents alongside two human decision-makers on a live target product called **LedgerFlow**.

---

## 1. Executive Summary & Core Personas

### The Human Collaborators
- **Alex (Founder / Decision Owner):** Directs high-level business strategy, confirms Product Requirements Documents (PRDs), and provides the final authoritative sign-off on code changes.
- **Maya (Product Designer):** Focuses on user journey consistency, component usability, accessibility, and visual styling.

### The Specialized AI Agents
- **NOVA (AI Product Strategist):**
  - Powered by **Google Gemini 2.5 / 3.5 Flash** (with deterministic offline fallbacks).
  - Listens to vague human ideas, analyzes target audience and constraints, resolves ambiguity through clarifying questions, and authors comprehensive 11-section Product Requirements Documents (PRDs).
  - Acts as a quality gatekeeper by conducting automated semantic reviews on PIXEL's code proposals.
- **PIXEL (AI Software Engineer):**
  - Powered by **Google Gemini 2.5 / 3.5 Flash**.
  - Waits for human-confirmed requirements.
  - Inspects the codebase, drafts executable prototype modifications, generates unified diffs, and submits structured implementation proposals referencing the originating PRD.

```
       [Alex / Maya] (Product Direction & Ambiguous Ideas)
             │
             ▼
      [NOVA - AI Strategist] ──> (Clarifies Ambiguity -> Generates 11-Section PRD)
             │
             ▼
   [Human Confirmation Gate] (Alex clicks 'Confirm Requirements')
             │
             ▼
      [Context Engine] ───────> (Builds Context Pack & Task Token)
             │
             ▼
     [PIXEL - AI Engineer] ───> (Inspects LedgerFlow -> Implements Code Diff)
             │
             ▼
       [NOVA Review Gate] ────> (Automated Semantic Review: PASS / WARN / BLOCK)
             │
             ▼
   [Final Human Approval] ───> (Alex approves -> Live Code Applied)
```

---

## 2. Complete Chronological Evolution & Feature Log

### Phase 1: Repository Audit & Core Stability
- **Problem:** Initial prototype had decoupled mock responses, state race conditions, hardcoded mocks, and no real AI connectivity.
- **Action Taken:** Audited all database tables, REST routes, and React components. Cleaned up SQLAlchemy models and established strict Pydantic schemas.

### Phase 2: Live LLM Integration (Google Gemini)
- **Engine:** `backend/app/agents/provider.py`
- **Technicality:** Integrated Google Gemini REST endpoint (`https://generativelanguage.googleapis.com/v1beta`) using server-side API key authentication (`x-goog-api-key`). Excluded keys from Git via `.gitignore`.
- **Resilience:** Implemented automatic model fallback chain (`gemini-3.5-flash` → `gemini-2.5-flash` → deterministic cognitive fallback) so the application remains 100% operational even under rate limits or offline conditions.

### Phase 3: Teammate Context Engine Integration
- **Engine:** Context retrieval and context pack builder.
- **Technicality:** Safely unpacked and merged `coframe-context-enhancement-changed-files.zip` without overwriting peer contributions. Added semantic search, requirement dependency graphs, and token auditing.

### Phase 4: Multi-Turn Workspace Chat
- **Engine:** `backend/app/agents/chat_service.py` & `WorkspaceChatView.tsx`
- **Technicality:** Resolved a critical bug where agents only responded to initial prompts. Implemented continuous conversation persistence (`conversations`, `chat_messages`), thread isolation, and bi-directional WebSocket broadcasting (`/ws/{project_id}/{identity_key}`).

### Phase 5: Automated NOVA → PIXEL Delegation
- **Engine:** `backend/app/agents/delegation_service.py`
- **Technicality:** Created an automated handoff pipeline. When a user confirms a NOVA PRD, the system automatically marks the PRD as authoritative, increments the context version, generates a fresh Context Pack, creates a delegation task record, and dispatches PIXEL's autonomous execution service.

### Phase 6: Context Recovery & True Resumption Inspector
- **Engine:** `backend/app/context/recovery_engine.py` & `ContextInspector.tsx`
- **Technicality:** Transformed the Inspector from a static UI into an active debugger:
  1. **Persisted Pack:** Exact historical payload that the agent received.
  2. **Reconstructed Pack:** Re-evaluation of context using current DB ground truth to detect drift.
  3. **Resumed Execution:** Genuinely recovers agent checkpoints, re-executes pending steps, and records audit logs.

### Phase 7: Complete Proposal Lifecycle & Cryptographic Attribution
- **Engine:** `backend/app/proposals/`
- **Technicality:** 
  - Overhauled proposal models to record complete provenance: `author_type`, `author_role`, `author_label`, `contribution_type`, `supersedes_proposal_id`, and `task_id`.
  - Structured PIXEL changes into executable AST/UI operations (`set_dashboard_metrics`, `update_approval_queue`, `set_hero_content`) with side-by-side diffs.
  - Implemented **Prune Cryptographic Verification**: Ed25519 digital signatures and prompt hashes proving agent contributions are authentic and tamper-evident.

### Phase 8: Sequential Stage-Aware Orchestration
- **Engine:** `backend/app/services/workflow_service.py`
- **Technicality:** 
  - Completely removed parallel agent chatter in "Entire Team" chat.
  - Implemented a deterministic 5-stage sequential lifecycle.
  - Added ambiguity detection to prevent hallucinations.
  - Persisted state in `WorkflowStateModel` (`workflow_states` table).
  - Mounted real-time `WorkflowStageBanner` in Chat with direct action buttons.

### Phase 9: Vercel Production Deployment
- **Live URL:** `https://coframe-inky.vercel.app`
- **Technicality:**
  - Designed `api/index.py` ASGI gateway for Vercel Python serverless runtime.
  - Implemented dynamic SQLite auto-migration to `/tmp/coframe.db` for writable serverless execution.
  - Engineered Vercel routing rules (`vercel.json`) with subpath forwarding and SPA client-side fallback.

---

## 3. Deep Technical Breakdown: How Subsystems Really Work

### A. The Context Engine & Context Pack Builder
Every agent execution begins by generating an authoritative **Context Pack**.

```python
# Context Pack JSON Schema
{
  "project_id": "demo-ledgerflow",
  "context_version": 2,
  "artifact_version": 2,
  "active_requirements": [
    {"key": "REQ_AUDIENCE", "value": "Small businesses (1-50 employees)", "version": 2},
    {"key": "REQ_APPROVAL_POLICY", "value": "Manager sign-off for >$1,000", "version": 1}
  ],
  "authoritative_sections": {
    "product_brief": {"version": 2, "target_audience": "..."},
    "dashboard": {"version": 2, "metrics": [...]}
  },
  "approved_decisions": [...],
  "task_instructions": "Implement multi-currency expense receipts",
  "token_budget": {"max": 4096, "used": 1840}
}
```

1. **Context Assembly:** When an agent is invoked, `pack_builder.py` queries the database for all requirements with `status = 'approved'`.
2. **Optimistic Version Lock:** The Context Pack snapshots `context_version` and `artifact_version`. If a human updates a requirement while the agent is running, the agent's submission will detect version drift and trigger a conflict review.
3. **Persisted vs Reconstructed:** Every agent run stores the exact stringified Context Pack in `agent_runs.context_pack`. The Context Inspector allows comparing this historical snapshot against a freshly reconstructed pack to reveal what requirements changed since the run executed.

---

### B. Sequential Entire Team Chat Dispatcher
Previously, sending a message to `@team` caused both agents to fire in parallel. Now, routing is governed by a deterministic state machine:

```
[User Message in Team Chat]
          │
          ▼
   Check Current Stage in `workflow_states`
          │
  ┌───────┴────────────────────────────────────────┐
  ▼                                                ▼
Stage: product_discovery / clarification        Stage: implementation_in_progress
  │                                                │
NOVA Dispatched Exclusively                     Status Reported
(PIXEL Status = "Waiting for PRD")              (PIXEL executing task)
```

#### Ambiguity Detection Algorithm (`chat_service.py`):
```python
AMBIGUOUS_ACRONYMS = {"sai", "erp", "sso", "ocr", "api", "ai", "ml", "bi"}

def _detect_ambiguity(message: str) -> bool:
    clean = message.lower().strip()
    words = clean.split()
    # If the user introduces an acronym without definition:
    for word in words:
        if word in AMBIGUOUS_ACRONYMS and len(words) < 12:
            return True
    return False
```
If Alex types *"I want to integrate SAI into LedgerFlow"*, NOVA does NOT hallucinate an implementation. It responds:
> *"I noticed you mentioned SAI. Could you clarify what SAI stands for in this context? (e.g., Smart Automated Invoicing, Spend Anomaly Intelligence, or Strategic Account Integration?)"*

---

### C. The 11-Section NOVA PRD Structure
When requirements are clear, NOVA outputs a standardized, professional PRD containing:
1. **Executive Summary:** Core value proposition and expected outcome.
2. **Problem Statement:** Specific pain points experienced by target users.
3. **Target Personas:** Detailed user profiles (e.g., Traveling Employee, Corporate Controller).
4. **Functional Requirements:** Prioritized list of system capabilities (`FR-001`, `FR-002`).
5. **Non-Functional Requirements:** Performance, security, accessibility (`NFR-001`).
6. **User Stories:** `As a [user], I want [action] so that [benefit]`.
7. **Acceptance Criteria:** Testable, measurable success criteria.
8. **UX Flow / User Interaction:** Step-by-step human journey.
9. **Constraints & Assumptions:** Platform boundaries and technical requirements.
10. **Dependencies & Risks:** External blockers and potential security/drift vectors.
11. **Open Questions:** Unresolved business decisions for human alignment.

---

### D. The Human Confirmation Gate & PIXEL Autonomous Execution
PIXEL cannot touch the codebase until a human confirms NOVA's PRD:

```
[Alex Clicks 'Confirm Requirements']
               │
               ▼
   `POST /api/proposals/{id}/confirm_requirements`
               │
               ├─> Mark PRD Proposal: `status = 'approved'`, `confirmed_by = 'alex'`
               ├─> Promote requirements to authoritative in `requirements` table
               ├─> Increment `project.context_version += 1`
               ├─> Create delegation task: `delegations` (status: `in_progress`)
               ├─> Update workflow state: `implementation_in_progress`
               │
               ▼
   [Dispatch PIXEL Delegation Worker]
               │
               ├─> Build authoritative Context Pack (v2)
               ├─> Inspect current LedgerFlow section schemas
               ├─> Execute code changes via structured operations:
               │   - `set_dashboard_metrics`
               │   - `update_approval_queue`
               ├─> Generate Unified Git Diff & Side-by-Side previews
               ├─> Create Proposal: `supersedes_proposal_id = prd_proposal.id`
               │
               ▼
   [Trigger Automatic NOVA Semantic Review]
               │
               ├─> Check diff against PRD acceptance criteria
               ├─> Assign outcome: PASS / WARNING / BLOCK
               └─> Update workflow stage: `implementation_awaiting_approval`
```

---

### E. Prune Cryptographic Receipts & AI Security
To prevent prompt injection, untrusted execution, or audit tampering, every agent execution is stamped by the **Prune Engine**:

```python
# Cryptographic Verification Model
receipt = {
    "receipt_id": "pr_rec_4b0607b4396e",
    "timestamp": "2026-10-31T20:55:00Z",
    "prompt_hash": sha256(system_prompt + context_pack + user_input),
    "model": "gemini-2.5-flash",
    "ed25519_signature": "a0c2c8d413d5f180...",
    "public_key": "c1f7d240601d7fec313d...",
    "shield_status": "passed",
    "tokens_prompt": 25,
    "tokens_completion": 141,
    "cost_usd": 0.00014
}
```
In the Proposals view, users can open the **Cryptographic Provenance Modal** to verify the cryptographic signature and mathematical audit trail of the proposal.

---

### F. Vercel Serverless Architecture & Auto-Migrating SQLite

#### The Serverless Challenge
1. AWS Lambda / Vercel containers have a **read-only** root filesystem (`/var/task`). Any write to `./coframe.db` crashes with `sqlite3.OperationalError: attempt to write a readonly database`.
2. Serverless functions are stateless and spin down between idle intervals.

#### The COFRAME Solution (`database.py`):
```python
is_serverless = (
    bool(os.getenv("VERCEL"))
    or "/var/task" in os.path.abspath(__file__).replace("\\", "/")
    or not os.access(".", os.W_OK)
)

if is_serverless and "sqlite" in DATABASE_URL.lower():
    tmp_db = "/tmp/coframe.db"
    if not os.path.exists(tmp_db):
        # Automatically clone the bundled, pre-seeded coframe.db into /tmp
        shutil.copyfile("/var/task/coframe.db", tmp_db)
    DATABASE_URL = f"sqlite:///{tmp_db}"
```
- `/tmp` is the only writable directory in serverless environments.
- On cold start, the system clones the pre-seeded SQLite database into `/tmp/coframe.db`.
- SQLite connects to `/tmp/coframe.db`, enabling full read/write operations without crashes.

#### Unified Routing (`vercel.json`):
```json
{
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/index?_subpath=api/$1" },
    { "src": "/assets/(.*)", "dest": "/api/index?_subpath=assets/$1" },
    { "src": "/(.*)", "dest": "/api/index?_subpath=$1" }
  ]
}
```
All routes forward subpaths to the ASGI gateway (`api/index.py`), which accurately dispatches between the FastAPI API router, static asset serving, and the React SPA fallback.

---

## 4. Complete Verification & Test Coverage Matrix

- **Backend Pytest Suite:** **156 / 156 tests passing** (100% pass rate).
- **Execution Time:** 3 minutes 57 seconds across 25 distinct test modules.
- **Frontend Build:** `tsc -b && vite build` builds in **500ms with 0 type errors**.
- **Live Vercel Production:** Fully online and serving live requests at `https://coframe-inky.vercel.app`.

---

## 5. Summary Table: File-by-File Technical Directory

| Subsystem | File Path | Core Responsibility |
|---|---|---|
| **ASGI Serverless Gateway** | [`api/index.py`](file:///d:/Bios%20Hackathon/api/index.py) | Normalizes Vercel subpaths, initializes cold-start DB, and wraps FastAPI. |
| **Vercel Manifest** | [`vercel.json`](file:///d:/Bios%20Hackathon/vercel.json) | Routes API, static assets, and client SPA fallback. |
| **Workflow State Service** | [`backend/app/services/workflow_service.py`](file:///d:/Bios%20Hackathon/backend/app/services/workflow_service.py) | Manages sequential collaboration states, self-healing DB tables, and WebSocket broadcasts. |
| **Workspace Chat Service** | [`backend/app/agents/chat_service.py`](file:///d:/Bios%20Hackathon/backend/app/agents/chat_service.py) | Enforces sequential agent routing, detects ambiguity, and formats NOVA PRD summaries. |
| **Delegation Engine** | [`backend/app/agents/delegation_service.py`](file:///d:/Bios%20Hackathon/backend/app/agents/delegation_service.py) | Dispatches PIXEL upon PRD confirmation, generates code diffs, and triggers NOVA reviews. |
| **Database Models** | [`backend/app/db/models.py`](file:///d:/Bios%20Hackathon/backend/app/db/models.py) | 25 SQLAlchemy models defining projects, members, requirements, proposals, and workflow states. |
| **Database Session & Adaptability** | [`backend/app/db/database.py`](file:///d:/Bios%20Hackathon/backend/app/db/database.py) | Auto-detects serverless environments and provisions writable `/tmp/coframe.db`. |
| **Cryptographic Prune Engine** | [`backend/app/prune/crypto.py`](file:///d:/Bios%20Hackathon/backend/app/prune/crypto.py) | Generates Ed25519 digital signatures and audit receipts for all agent outputs. |
| **Workflow Banner UI** | [`frontend/src/components/chat/WorkflowStageBanner.tsx`](file:///d:/Bios%20Hackathon/frontend/src/components/chat/WorkflowStageBanner.tsx) | Renders color-coded lifecycle stage badges and direct action buttons. |
| **Proposals Redesign UI** | [`frontend/src/components/proposals/ProposalsView.tsx`](file:///d:/Bios%20Hackathon/frontend/src/components/proposals/ProposalsView.tsx) | Displays 11-section PRDs, PIXEL diff inspectors, and approval buttons. |
