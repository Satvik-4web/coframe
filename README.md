# COFRAME — Human + AI, One Shared Creation

> **BIOS FORGE Hackathon Project**  
> **Demo Artifact:** LedgerFlow (Enterprise Expense Management Product Prototype)  
> **Mission:** One Shared Product. Four Collaborators. Always-Understandable Context.

---

## 1. Executive Summary (500–600 Words)

Modern AI development typically treats AI agents as ephemeral, disconnected conversational chatbots or opaque code generators. When humans attempt to build real products alongside AI, chaos quickly ensues: agents invent phantom version numbers, silently overwrite teammate progress, get out of sync when requirements change, and lose all context when a process crashes.

**COFRAME fundamentally solves this.** It is an authoritative multiplayer workspace where two identifiable humans—**Alex** (Founder / Decision Owner) and **Maya** (Product Designer)—and two specialized AI agents—**NOVA** (Product Strategist) and **PIXEL** (Prototype Engineer)—collaborate in real time on one evolving product artifact called **LedgerFlow**.

Unlike conventional chat interfaces, COFRAME establishes the backend as the single source of truth. AI agents do not write directly to the product; every significant contribution is submitted as a structured proposal. The backend stamps authoritative metadata—including proposal IDs, timestamps, base context versions, base artifact versions, and base section versions—drawn from an immutable, persisted **Context Pack**.

COFRAME introduces three foundational context reliability breakthroughs:

1. **Selective Staleness:** When Alex updates the target audience requirement (`REQ_AUDIENCE`) from small businesses to enterprise finance teams, the system does not globally invalidate every open proposal. Instead, it performs an exact set-intersection between the changed requirement keys and each proposal's declared `affected_requirements`. Proposal A (which depends on audience positioning) is selectively marked **STALE** with a clear explanation, while Proposal B (which depends only on spend metrics) survives and remains immediately eligible for review.

2. **Section Conflict Resolution:** When Maya manually refines the Hero section directly in the prototype, the section version increments from v1 to v2. When PIXEL's older hero proposal (based on v1) is evaluated, COFRAME's atomic engine detects the version mismatch and marks it as a **CONFLICT**. Rather than throwing a cryptic error, COFRAME presents a clean side-by-side comparison (Maya's current version vs. PIXEL's proposed version) and empowers Maya to either keep her handcrafted version or redirect PIXEL with specific corrective instructions.

3. **Authentic Agent Recovery & High-Impact Human Governance:** When an agent restarts, COFRAME never dumps unreadable chat logs or fabricates a fake recovery message. Instead, the backend reconstructs a fresh, typed Context Pack directly from persisted database state (verified requirements, section versions, and offline events). Furthermore, backend policy mandates that high-impact proposals (such as tiered approval thresholds and role permissions) require explicit signoff by Alex (`requires_decision=True`). If Maya attempts approval, the server enforces HTTP 403 Forbidden. Alex can redirect the agent with a human guidance note ("Make approval thresholds configurable per organisation"), prompting PIXEL to generate a revised, linked proposal that Alex ultimately approves.

At the top of the workspace, the **Observer Summary** synthesizes *What Changed*, *Why*, and *What Happens Next* in plain language, empowering non-technical judges and founders to understand the entire product evolution without wading through raw developer logs.

---

## 2. Functional vs. Simulated Matrix

Per competition standards, every capability's implementation status is disclosed below (see [`docs/FUNCTIONAL_VS_SIMULATED.md`](./docs/FUNCTIONAL_VS_SIMULATED.md) for full breakdown):

| Capability | Reality | Verification Detail |
| :--- | :--- | :--- |
| **Two Human Sessions** | Functional Demo Identity Selector | Rapid role switcher without signup friction; active presence indicator updates across tabs. |
| **Decision Permissions** | Functional Server Rule Engine | Backend restricts high-impact proposals (`requires_decision=True`) to Alex. Maya receives HTTP 403. |
| **Realtime Sync** | Functional WebSockets | FastAPI WebSocket broadcasts events, edits, and presence instantaneously. |
| **NOVA & PIXEL** | Live LLM + Labeled Fallback | Live provider (Gemini/OpenAI/Claude); if key omitted, uses labeled deterministic fallback. |
| **Context Pack** | Functional Persisted Pack | Stored immutably on `agent_runs.context_pack`; inspectable in Context Inspector. |
| **Selective Staleness** | Functional Set-Intersection | `changed_keys ∩ affected_requirements`. Proposal A stales; Proposal B survives. |
| **Section Conflict** | Functional Compare-and-Swap | Detected when base section version < current section version; side-by-side diff review. |
| **Atomic Apply Engine** | Functional ACID Transaction with CAS | Database transaction rechecks all section versions and permissions before atomic write; rolls back on error. |
| **Dual Agent Redirect** | Functional Lineage Tracking | Both NOVA and PIXEL support human redirects, generating revised proposals linked by `supersedes_proposal_id`. |
| **Agent Recovery** | Functional State Rebuild | Fresh Context Pack generated from DB state with authentic recovery summary. |
| **Observer Summary** | Functional Synthesis | What Changed / Why / What Next banner with source event citations. |
| **Prototype Renderer** | Functional React Components| Fixed React suite (`LedgerFlowHero`, `MetricGrid`, `ApprovalQueue`). No arbitrary eval. |
| **Deterministic Reset** | Functional Database Seed | `POST /api/demo/reset` restores baseline LedgerFlow artifact in 1 click. |
| **GitHub Integration** | Functional Outbox & Git DB API | Connects real repositories, creates isolated branches, creates atomic commits via Git Database API, and opens reviewable Pull Requests. |
| **Prune AI Seatbelt** | Functional Gateway & Ed25519 Receipts | Official BIOS V2 workshop integration: Key Vault (AES-256-GCM), Shield prompt injection defense, exact cache ($0 repeat billing), and Ed25519 signed receipts. |

---

## 3. Quick Start & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Clone & Configure
```bash
git clone https://github.com/Satvik-4web/coframe.git
cd "Bios Hackathon"

# Copy environment configuration
cp .env.example .env
```

### 2. Automated Full-Stack Verification (Recommended)
Run the automated verification script, which tests runtimes, builds the frontend, validates backend readiness, runs the 17 Pytest tests, and performs the headless Playwright browser E2E test:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify.ps1
```

### 3. Manual Run Options

#### Option A: Unified Full-Stack Run (Single Command)
Build the frontend and run the complete application via FastAPI:
```bash
# In frontend directory
cd frontend
npm install
npm run build
cd ..

# Run backend (serves API and built SPA)
python -m uvicorn backend.app.main:app --port 8000 --reload
```
Open **`http://localhost:8000`** in your browser.

#### Option B: Development Mode (Vite + FastAPI)
**Terminal 1 (Backend):**
```bash
python -m uvicorn backend.app.main:app --port 8000 --reload
```

**Terminal 2 (Frontend Dev Server):**
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 4. Rehearsing the 7-Step Hackathon Demo

Use the **Demo Walkthrough Stepper** at the top of the COFRAME workspace to execute each step:

1. **Step 1 — Establish Task & Identities:** Open two browser windows (e.g. Chrome normal + Incognito). Join one as **Alex** and the other as **Maya**. Both show green online presence dots.
2. **Step 2 — Start Parallel Agent Contributions:** Click **Start Collaboration**. NOVA and PIXEL run in parallel. Three proposals appear: Proposal A (Audience), Proposal B (Metrics), Proposal C (Hero).
3. **Step 3 — Change Requirement Mid-Flight:** In Alex's window, update `REQ_AUDIENCE` from *Small businesses* to *Enterprise finance teams*. `context_version` increments to v2; Observer Summary updates.
4. **Step 4 — Handle Outdated & Conflicted Work:**
   - **Case A (Selective Stale):** Proposal A turns red/STALE ("Written for small businesses..."). Proposal B stays green/PENDING because metrics were untouched!
   - **Case B (Section Conflict):** Click *Manual Edit Hero* as Maya. Maya saves custom hero copy (hero becomes v2). Proposal C turns red/CONFLICT. Click *Compare Side-by-Side Conflict* to see Maya's version vs. PIXEL's version.
5. **Step 5 — Restart Agent & Context Recovery:** Go to Agent Activity and click *Restart NOVA*. Backend reconstructs a fresh Context Pack from SQLite/Postgres. Inspect the exact pack in the Context Inspector.
6. **Step 6 — High-Impact Human Decision:** Click *Propose Enterprise Policy (PIXEL)*. Proposal D is flagged with *Requires Alex Approval*. Maya is blocked (HTTP 403). Alex clicks *Redirect*, writes: *"Make approval thresholds configurable per organisation"*. PIXEL generates a revised proposal linked by `supersedes_proposal_id`. Alex approves.
7. **Step 7 — Inspect Shared LedgerFlow Canvas:** Open the Product Canvas tab. The live React prototype displays the revised hero, enterprise metrics, and configurable approval queue!

---

## 5. Automated Test Suite

### 1. Pytest Unit, Concurrency, and GitHub Test Suites
Execute the full backend test suite covering 32 automated tests across atomic CAS transactions, multi-section rollback, selective staleness, section conflicts, agent recovery, NOVA/PIXEL redirects, permission enforcement, and the comprehensive GitHub integration (Outbox pattern, branches, commits, PRs, and API endpoints):

```bash
python -m pytest backend/tests/test_backend.py backend/tests/test_api_endpoints.py backend/tests/test_concurrency_and_redirect.py backend/tests/test_github_integration.py backend/tests/test_github_api_endpoints.py -v
```
*Results:* **32 passed** in ~2.3 seconds.

Key test suites include:
- `test_competing_manual_edits`: Verifies compare-and-swap rejection on stale version writes.
- `test_proposal_apply_vs_manual_edit_conflict`: Verifies concurrent manual edit causes pending proposal apply to abort cleanly.
- `test_multi_section_partial_write_prevention_and_rollback`: Proves database transaction atomicity—if a section version fails, all writes roll back.
- `test_redirect_nova_and_pixel_preserves_supersedes_relationship`: Validates dual redirect for both NOVA and PIXEL with fresh Context Pack and `supersedes_proposal_id` lineage.
- `test_decision_permissions_alex_vs_maya`: Verifies server-side authorization blocking unauthorized identities from high-impact decisions.
- `test_full_publish_and_idempotency`: Verifies isolated branch, commit creation via Git Database API, PR generation, and idempotency protection against duplicate publications.
- `test_outbox_job_created_on_apply_and_failure_isolated`: Validates transactional Outbox sync job creation and proves GitHub failures never roll back approved COFRAME artifacts.

### 2. Playwright Multi-Browser End-to-End Suite
Execute the full multi-session browser interaction test:

```bash
python backend/tests/test_playwright_e2e.py
```
*Results:* **All 11 test stages passed**, capturing full-fidelity screenshot to `docs/demo_screenshot.png`.

---

## 6. GitHub Integration Architecture & Guide
For full architecture diagrams, token permission requirements, and live demo choreography, refer to the dedicated guide:  
**[`docs/GITHUB_INTEGRATION.md`](./docs/GITHUB_INTEGRATION.md)**

---

## 7. Prune AI Seatbelt Integration (Official BIOS V2 Workshop)

COFRAME natively integrates **Prune** ([`app.withprune.com`](https://app.withprune.com)), the AI seatbelt presented by Karanbir Rattan Bhardwaj at BIOS V2:

- **Key Vault (AES-256-GCM):** Upstream provider keys are kept securely out of source code and Git.
- **Shield Guardrails:** Automatically intercepts prompt injections (`"Ignore previous instructions"`), leaks of API keys, and unredacted PII before requests reach LLMs.
- **Exact Prompt Caching:** Repeat queries hit the cache at **$0.000000 cost** (100% token savings), achieving up to **~94% cost reduction** vs raw GPT-4o.
- **Automatic Fallback:** Gracefully retries on backup models (`PRUNE_BACKUP_MODEL`) when primary models face timeouts or rate limits.
- **Ed25519 Cryptographic Signed Receipts:** Every agent run and proposal is stamped with a verifiable digital signature inspectable directly in the UI.

For complete details and architecture diagrams, see:  
**[`docs/PRUNE_INTEGRATION.md`](./docs/PRUNE_INTEGRATION.md)**

To run the Slide 4 Prompt-to-Receipt live demo in your terminal:
```powershell
python scripts/prune_workshop_demo.py
```

---

## 8. Technology Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons
- **Backend:** FastAPI, Python 3.10+, SQLAlchemy 2.0, Pydantic v2
- **Database:** SQLite (local zero-dependency mode) / Supabase PostgreSQL
- **Realtime:** WebSockets with live multi-user presence
- **AI Integration:** Multi-provider adapter (Gemini 2.5 Flash, OpenAI, Claude, OpenRouter) with labeled deterministic fallbacks

---

## 7. Team Details & Submission

- **Team:** BIOS FORGE Hackathon Team
- **Artifact:** LedgerFlow Expense Management System
- **Repository:** https://github.com/Satvik-4web/coframe
