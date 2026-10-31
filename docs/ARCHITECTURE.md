# COFRAME — System Architecture & Workflow Specification

## 1. Architectural Philosophy: The Calm Mission Control

COFRAME treats human-AI product creation not as an unstructured chat log, but as an **authoritative multiplayer workspace** governed by strict data contracts, selective dependency versioning, and ACID persistence.

```mermaid
graph TD
    subgraph "Human Collaborators"
        ALEX["Alex (Founder / Decision Owner)"]
        MAYA["Maya (Product Designer)"]
    end

    subgraph "COFRAME Frontend (React + TypeScript + Vite + Tailwind)"
        TOP["TopBar: Presence, Versions & Reset"]
        OBS["Observer Summary: What Changed / Why / Next"]
        STEP["Interactive 7-Step Demo Guide"]
        CANVAS["LedgerFlow Prototype Canvas"]
        QUEUE["Proposal Review Queue"]
        INSPECT["Context Pack Inspector"]
    end

    subgraph "FastAPI Collaborative Backend"
        API["REST API Router (/api)"]
        WS["Realtime WebSocket Manager (/ws)"]
        STAMP["Authoritative Stamping Engine"]
        STALE["Selective Staleness Checker"]
        APPLY["Atomic Apply & Decision Gate"]
        PACK["Context Pack Builder"]
    end

    subgraph "Autonomous AI Agents"
        NOVA["NOVA (Product Strategist)"]
        PIXEL["PIXEL (Prototype Engineer)"]
        ADAPT["LLM Provider Adapter + Fallback"]
    end

    subgraph "Database & Storage (SQLite / Supabase Postgres)"
        PROJECTS[("projects")]
        REQS[("requirements")]
        SECTIONS[("artifact_sections")]
        EVENTS[("events")]
        RUNS[("agent_runs")]
        PROPOSALS[("proposals")]
        DECISIONS[("decisions")]
    end

    ALEX <--> TOP
    MAYA <--> CANVAS
    TOP <--> API
    CANVAS <--> API
    TOP <--> WS
    API --> STAMP
    API --> APPLY
    STAMP --> PROPOSALS
    APPLY --> SECTIONS
    APPLY --> EVENTS
    PACK --> RUNS
    RUNS --> NOVA
    RUNS --> PIXEL
    NOVA --> ADAPT
    PIXEL --> ADAPT
    ADAPT --> STAMP
    API --> STALE
    STALE --> PROPOSALS
```

---

## 2. Core Versioning Contracts

COFRAME maintains three independent, uncollapsed version counters:

1. `context_version`: Incremented whenever project requirements or decisions are updated by human collaborators.
2. `artifact_version`: Incremented whenever an approved proposal or manual edit modifies the overall Product Canvas.
3. `section_versions`: Discrete version integer per target section (`product_brief: vX`, `hero: vY`, `dashboard: vZ`, `approval_queue: vW`).

---

## 3. Seven-Step Demo Flow Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Alex as Alex (Founder)
    actor Maya as Maya (Designer)
    participant API as FastAPI Backend
    participant NOVA as NOVA Agent
    participant PIXEL as PIXEL Agent
    participant DB as Supabase / DB

    Alex->>API: Step 1: Join Session & Reset Demo
    Maya->>API: Join Session (Realtime Presence)
    Alex->>API: Step 2: Start Collaboration
    API->>NOVA: Build Context Pack & Dispatch Run
    API->>PIXEL: Build Context Pack & Dispatch Run
    NOVA-->>API: Output Proposal A (Audience) & B (Metrics)
    PIXEL-->>API: Output Proposal C (Hero)
    API->>DB: Stamp & Persist Proposals (Pending Review)

    Alex->>API: Step 3: Update REQ_AUDIENCE ("Enterprise finance teams")
    API->>DB: Increment context_version (v1 -> v2)
    API->>API: Step 4A: Intersect affected_requirements (Proposal A STALE, Proposal B Survives)

    Maya->>API: Step 4B: Manual Edit Hero Section
    API->>DB: Increment hero section version (v1 -> v2)
    API->>API: Compare Proposal C base_version (v1 vs v2 -> CONFLICT)

    Alex->>API: Step 5: Restart NOVA
    API->>NOVA: Build Fresh Context Pack from Persisted State
    NOVA-->>API: Recovery Summary Generated

    Maya->>API: Step 6A: Reconcile Proposal A with Enterprise Context
    NOVA-->>API: Revised Enterprise Positioning Proposal
    PIXEL->>API: Propose High-Impact Manager Approval Policy
    Note over API: Backend marks requires_decision=True, assigned_decider=Alex
    Maya-->>API: Maya attempts approval (Blocked: 403 Forbidden)
    Alex->>API: Alex Redirects with note: "Configurable per org"
    PIXEL-->>API: Revised Configurable Policy Proposal
    Alex->>API: Alex Approves Revised Policy

    Alex->>API: Step 7: View Shared LedgerFlow Product Canvas
    Note over API: Artifact version v3, Hero v2, Approval Queue v2
```
