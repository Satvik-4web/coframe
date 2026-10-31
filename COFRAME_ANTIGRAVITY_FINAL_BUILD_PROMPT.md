# COFRAME — FINAL ANTIGRAVITY BUILD PROMPT
Project: COFRAME — Human + AI, One Shared Creation
Hackathon: BIOS FORGE
Build window: 24 hours (plan against 24 hours unless the organisers explicitly confirm otherwise)
Team: 4 developers
Demo artifact: LedgerFlow, a small enterprise expense-management product prototype
Primary goal: Deliver one polished, working end-to-end collaboration experience that satisfies every required capability and all seven demo steps.

## 0. EXECUTION DIRECTIVE — READ BEFORE CODING
You are the lead product engineer and implementation agent for COFRAME. Build the actual working application described in this document. This is an implementation specification, not a brainstorming exercise.

### Non-negotiable rules
1. The 24-hour constraint is real. Build the smallest complete system that proves the required collaboration behaviours. Do not turn this into a general-purpose website builder, coding IDE, project-management suite or enterprise SaaS platform.
2. P0 means required. Do not start P1 features while a P0 acceptance test is failing.
3. The backend is the source of truth. The LLM must never invent proposal IDs, timestamps, context versions, artifact versions, section versions, statuses or permissions. The backend stamps and validates all authoritative metadata.
4. No arbitrary generated code execution. PIXEL returns constrained JSON. A fixed, trusted React renderer converts approved JSON into the prototype. Never eval, dynamically import, or execute model-generated JavaScript/React code.
5. Every significant agent contribution is a proposal. Agents cannot silently write to the approved artifact.
6. All apply-time version checks and writes must be atomic. Use database transactions, row locks and/or compare-and-swap updates. A frontend-only version check is insufficient.
7. Staleness is selective. An unrelated requirement change must not invalidate every proposal.
8. Redirect and Reconcile must cause real agent work. Capture the human's instruction, call the originating agent with current context, and persist a new linked proposal.
9. Recovery must use persisted state. Do not simulate an agent restart by displaying a hardcoded recovery sentence.
10. Make simulated behaviour visible. Cached fallback responses, fixture data and other simulated elements must be labelled as such in the UI and documented in the README.
11. Preserve existing work. Inspect the repository and installed environment before changing files. Back up configuration before modifying it. Do not destroy unrelated project files.
12. Implement and verify in phases. Do not stop after producing an architecture plan or empty scaffolding.

### Required working style
- First inspect the existing workspace, Antigravity environment, installed runtimes and current files.
- Then produce a short implementation plan and immediately begin Phase 1.
- Create a BUILD_STATUS.md with P0 tasks, owner, status and blockers. Keep it updated.
- Make small, testable changes. Run checks after each milestone.
- If an external API key or account is unavailable, implement the integration boundary and an explicitly labelled deterministic fallback. Never claim the live integration is connected when it is not.
- If time is running short, cut P1 polish—not stale handling, recovery, observer summary, human approval or the live prototype.

## 1. PRODUCT DEFINITION
### 1.1 What COFRAME is
COFRAME is a multiplayer workspace where two identifiable humans and two distinct AI agents collaborate on one shared, evolving product artifact.
It must make AI work understandable to nontechnical users and keep humans meaningfully in control.

COFRAME is not:
- A chat interface with four avatars.
- Two unrelated AI chatbots.
- A universal AI coding IDE.
- A full website builder.
- A general project-management platform.
The actual product being built is the collaboration environment. LedgerFlow is the sample product artifact the collaborators evolve inside COFRAME.

### 1.2 Four collaborators
| Identity | Type | Role | Meaningful contribution |
| :--- | :--- | :--- | :--- |
| Alex | Human 1 | Founder / decision owner | Edits product requirements and makes high-impact decisions |
| Maya | Human 2 | Product designer | Manually edits prototype sections, reviews work and redirects agents |
| NOVA | AI Agent 1 | Product Strategist | Analyses requirements and proposes product-brief/strategy changes |
| PIXEL | AI Agent 2 | Prototype Engineer | Proposes structured changes to the LedgerFlow prototype |

NOVA and PIXEL may use the same underlying LLM model, but they must have separate instructions, responsibilities, tool permissions, task states and output validation.

### 1.3 One shared artifact
The LedgerFlow Product Canvas is a single persisted artifact composed of:
1. `product_brief`: target audience, problem, value proposition and approved product decisions.
2. `hero`: headline, supporting copy and primary call to action.
3. `dashboard`: a small set of finance metric cards.
4. `approval_queue`: manager-approval workflow preview.
5. Version metadata linking current state to approved proposals and human edits.

NOVA contributes to the product brief and strategy. PIXEL contributes to prototype sections. Both contribute to the same Product Canvas and its history.

### 1.4 Product success statement
A nontechnical judge should be able to watch the application and answer:
- Who is collaborating?
- What is each agent doing?
- What changed?
- Why did it change?
- Which work became outdated or conflicted?
- What did the agent recover after restarting?
- What decision did the human make?
- What does the final shared product look like?

## 2. THE REQUIRED END-TO-END DEMO
Implement and test this exact scenario. It is the central acceptance path, not an optional sample.

### 2.1 Deterministic demo project and requirement IDs
Stable requirement identifiers:
- `REQ_AUDIENCE`: Initial: "Small businesses". Later change: "Enterprise finance teams"
- `REQ_METRICS`: Initial: "Monthly spend, expense count and category breakdown". Unchanged during audience change.
- `REQ_BRAND`: Initial: "Clear, approachable finance-product messaging". Unchanged during audience change.
- `REQ_APPROVAL_POLICY`: Initial: "Manager approval approach/threshold not yet finalised". Later: Alex reviews proposed policy/threshold.
- `REQ_ROLES`: Initial: "Basic employee and manager roles". Later: refined by high-impact proposal.

Target section identifiers:
- `product_brief`
- `hero`
- `dashboard`
- `approval_queue`

### 2.2 Deterministic initial agent contributions
After Reset Demo, the project begins with a known initial state and LedgerFlow artifact. When the user clicks Start Collaboration, NOVA and PIXEL run in parallel:
1. NOVA proposal A — Audience positioning
   - affected_requirements: `REQ_AUDIENCE`
   - target_sections: `product_brief`
   - Must become STALE after Alex changes `REQ_AUDIENCE`.
2. NOVA proposal B — Metrics insight
   - affected_requirements: `REQ_METRICS`
   - target_sections: `dashboard`
   - Must remain eligible after the audience change because `REQ_METRICS` did not change.
3. PIXEL proposal C — Hero improvement
   - affected_requirements: `REQ_BRAND`
   - target_sections: `hero`
   - Must become a CONFLICT after Maya manually edits the hero section and increments its section version.

Use the live LLM to produce these outputs in normal path, with deterministic cached fallback when key is not provided or fails. Fallbacks must have `source = cached_fallback` and show visible `SIMULATED FALLBACK` badge.

### 2.3 Required demo sequence
- Step 1 — Establish shared task and identities (Alex / Maya join from separate tabs/windows, presence online, NOVA & PIXEL visible).
- Step 2 — Start distinct parallel agent contributions (Click Start Collaboration, immutable Context Pack, NOVA proposal A & B, PIXEL proposal C, idle -> working -> waiting for review).
- Step 3 — Change a significant requirement mid-flight (Alex changes REQ_AUDIENCE to "Enterprise finance teams", adds manager expense approval requirement, context_version incremented, event appended, Observer Summary updates).
- Step 4 — Outdated and incompatible contributions:
  - Case A (Selective stale): Proposal A stale (plain language explanation), Proposal B stays eligible. Reconcile button visible.
  - Case B (Human vs agent conflict): Maya manually edits Hero section (version increments). Proposal C marked conflict. Side-by-side comparison (Maya's current vs PIXEL's proposed), Keep Maya's Version and Redirect PIXEL actions.
- Step 5 — Restart agent & recover context: Restart NOVA. Run closed/interrupted, fresh Context Pack built from persisted state. NOVA recovery summary generated and displayed in Context Inspector.
- Step 6 — High-impact decision: Agent proposes manager approval policy/threshold (`requires_decision=true`, `assigned_decider_id="alex"` by backend policy). Maya can only inspect/comment, only Alex can approve/redirect. Alex clicks Redirect with note "Make approval thresholds configurable per organisation". Agent produces revised proposal linked by `supersedes_proposal_id`. Alex approves.
- Step 7 — Final shared product artifact: LedgerFlow Product Canvas showing brief, rendered prototype, approved changes, versions, event history, and Observer Summary.

## 3. P0 ARCHITECTURE & CONTRACTS
- Backend: FastAPI (Python 3.10+), SQLAlchemy / SQLite or PostgreSQL with atomic transactions.
- Frontend: React + TypeScript + Vite + Tailwind CSS + Lucide icons.
- Realtime: WebSocket / SSE / Supabase Realtime for instant multi-user synchronization.
- Observer Summary: What Changed, Why, What Happens Next banner at top.
- Data models: Projects, Project Members, Requirements, Artifact Sections, Events, Agent Runs, Proposals, Decisions.
