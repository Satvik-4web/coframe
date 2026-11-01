import datetime

from sqlalchemy import text

from sqlalchemy.orm import Session

from backend.app.db.database import Base, engine

from backend.app.db.models import (

    ProjectModel,

    ProjectMemberModel,

    RequirementModel,

    RequirementVersionModel,

    ArtifactSectionModel,

    ArtifactSectionVersionModel,

    EventModel,

    AgentRunModel,

    ProposalModel,

    DecisionModel,

    DelegationModel,

    ApprovalRequestModel,

    SharedResourceModel,

    GitHubConnectionModel,

    GitHubContributionModel,

    GitHubSyncJobModel,

    ExpenseModel,

    PRDModel,

    ImplementationPlanModel,

    ConversationModel,

    ConversationParticipantModel,

    ChatMessageModel,
    RecoveryRecordModel,
    PruneReceiptModel,
    WorkflowStateModel,

    utcnow_str,

)



DEMO_PROJECT_ID = "demo-ledgerflow"





def init_db(target_engine=None):

    use_engine = target_engine or engine

    Base.metadata.create_all(bind=use_engine)

    try:

        with use_engine.connect() as conn:

            columns_to_add = [

                ("requirements", "status", "VARCHAR(32) DEFAULT 'approved'"),

                ("artifact_sections", "status", "VARCHAR(32) DEFAULT 'approved'"),

                ("proposals", "prune_metadata", "JSON"),

                ("proposals", "proposal_type", "VARCHAR(64) DEFAULT 'prototype_modification'"),

                ("proposals", "created_by", "VARCHAR(64)"),

                ("proposals", "author_type", "VARCHAR(32) DEFAULT 'agent'"),

                ("proposals", "task_id", "VARCHAR(64)"),

                ("proposals", "reviewed_by", "VARCHAR(64)"),

                ("proposals", "review_outcome", "VARCHAR(32)"),

                ("proposals", "review_findings", "JSON"),

                ("proposals", "prd_data", "JSON"),

                ("proposals", "implementation_data", "JSON"),

                ("agent_runs", "prune_metadata", "JSON"),

                ("agent_runs", "lifecycle_state", "VARCHAR(32) DEFAULT 'idle'"),

                ("agent_runs", "last_heartbeat", "VARCHAR(64)"),

                ("agent_runs", "current_task", "TEXT"),

                ("agent_runs", "current_proposal_id", "VARCHAR(64)"),

                ("agent_runs", "task_start_time", "VARCHAR(64)"),

                ("agent_runs", "last_completed_task", "TEXT"),

                ("agent_runs", "completed_work", "JSON DEFAULT '[]'"),

                ("agent_runs", "pending_work", "JSON DEFAULT '[]'"),

                ("agent_runs", "idempotency_key", "VARCHAR(64)"),

                ("agent_runs", "last_processed_event_seq", "INTEGER DEFAULT 0"),

                ("events", "workspace_id", "VARCHAR(64)"),

                ("events", "entity_type", "VARCHAR(64)"),

                ("events", "entity_id", "VARCHAR(64)"),

                ("events", "correlation_id", "VARCHAR(64)"),

                ("events", "causation_id", "VARCHAR(64)"),

                ("events", "timestamp", "BIGINT"),
                ("proposals", "nova_review", "JSON"),

            ]

            for table, col, col_type in columns_to_add:

                cols = [r[1] for r in conn.execute(text(f"PRAGMA table_info({table})")).fetchall()]

                if col not in cols:

                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))

                    conn.commit()

    except Exception:

        pass





def reset_demo_database(db: Session, project_id: str = DEMO_PROJECT_ID):

    """Deterministically wipes and resets the project to the exact baseline defined in the specification."""

    init_db(db.get_bind())



    # Clear existing demo records

    db.query(GitHubSyncJobModel).filter(GitHubSyncJobModel.project_id == project_id).delete(synchronize_session=False)

    db.query(GitHubContributionModel).filter(GitHubContributionModel.project_id == project_id).delete(synchronize_session=False)

    db.query(GitHubConnectionModel).filter(GitHubConnectionModel.project_id == project_id).delete(synchronize_session=False)



    db.query(ChatMessageModel).filter(ChatMessageModel.conversation_id.in_(

        db.query(ConversationModel.id).filter(ConversationModel.project_id == project_id)

    )).delete(synchronize_session=False)

    db.query(ConversationParticipantModel).filter(ConversationParticipantModel.conversation_id.in_(

        db.query(ConversationModel.id).filter(ConversationModel.project_id == project_id)

    )).delete(synchronize_session=False)

    db.query(ConversationModel).filter(ConversationModel.project_id == project_id).delete(synchronize_session=False)



    db.query(DelegationModel).filter(DelegationModel.project_id == project_id).delete(synchronize_session=False)

    db.query(ApprovalRequestModel).filter(ApprovalRequestModel.project_id == project_id).delete(synchronize_session=False)

    db.query(SharedResourceModel).filter(SharedResourceModel.project_id == project_id).delete(synchronize_session=False)

    db.query(ExpenseModel).filter(ExpenseModel.project_id == project_id).delete(synchronize_session=False)

    db.query(ImplementationPlanModel).filter(ImplementationPlanModel.project_id == project_id).delete(synchronize_session=False)

    db.query(PRDModel).filter(PRDModel.project_id == project_id).delete(synchronize_session=False)



    db.query(DecisionModel).filter(DecisionModel.proposal_id.in_(

        db.query(ProposalModel.id).filter(ProposalModel.project_id == project_id)

    )).delete(synchronize_session=False)



    db.query(ProposalModel).filter(ProposalModel.project_id == project_id).delete(synchronize_session=False)

    db.query(AgentRunModel).filter(AgentRunModel.project_id == project_id).delete(synchronize_session=False)

    db.query(EventModel).filter(EventModel.project_id == project_id).delete(synchronize_session=False)

    db.query(ArtifactSectionVersionModel).filter(ArtifactSectionVersionModel.project_id == project_id).delete(synchronize_session=False)

    db.query(RequirementVersionModel).filter(RequirementVersionModel.project_id == project_id).delete(synchronize_session=False)

    db.query(ArtifactSectionModel).filter(ArtifactSectionModel.project_id == project_id).delete(synchronize_session=False)

    db.query(RequirementModel).filter(RequirementModel.project_id == project_id).delete(synchronize_session=False)

    db.query(ProjectMemberModel).filter(ProjectMemberModel.project_id == project_id).delete(synchronize_session=False)

    db.query(ProjectModel).filter(ProjectModel.id == project_id).delete(synchronize_session=False)



    # 1. Project

    project = ProjectModel(

        id=project_id,

        name="LedgerFlow",

        context_version=1,

        artifact_version=1,

        created_at=utcnow_str(),

        updated_at=utcnow_str(),

    )

    db.add(project)



    # 2. Members (Alex & Maya)

    members = [

        ProjectMemberModel(

            id=f"{project_id}-alex",

            project_id=project_id,

            identity_key="alex",

            display_name="Alex",

            role="Founder / Decision Owner",

            member_type="human",

        ),

        ProjectMemberModel(

            id=f"{project_id}-maya",

            project_id=project_id,

            identity_key="maya",

            display_name="Maya",

            role="Product Designer",

            member_type="human",

        ),

    ]

    db.add_all(members)



    # 3. Requirements (Stable Keys)

    requirements = [

        RequirementModel(

            id=f"{project_id}-req-audience",

            project_id=project_id,

            requirement_key="REQ_AUDIENCE",

            title="Target Audience",

            value="Small businesses",

            version=1,

            updated_by="alex",

            updated_at=utcnow_str(),

        ),

        RequirementModel(

            id=f"{project_id}-req-metrics",

            project_id=project_id,

            requirement_key="REQ_METRICS",

            title="Core Metrics",

            value="Monthly spend, expense count and category breakdown",

            version=1,

            updated_by="alex",

            updated_at=utcnow_str(),

        ),

        RequirementModel(

            id=f"{project_id}-req-brand",

            project_id=project_id,

            requirement_key="REQ_BRAND",

            title="Brand Voice & Messaging",

            value="Clear, approachable finance-product messaging",

            version=1,

            updated_by="alex",

            updated_at=utcnow_str(),

        ),

        RequirementModel(

            id=f"{project_id}-req-approval-policy",

            project_id=project_id,

            requirement_key="REQ_APPROVAL_POLICY",

            title="Approval Policy",

            value="Manager approval approach/threshold not yet finalised",

            version=1,

            updated_by="alex",

            updated_at=utcnow_str(),

        ),

        RequirementModel(

            id=f"{project_id}-req-roles",

            project_id=project_id,

            requirement_key="REQ_ROLES",

            title="Role Permissions",

            value="Basic employee and manager roles",

            version=1,

            updated_by="alex",

            updated_at=utcnow_str(),

        ),

    ]

    db.add_all(requirements)



    # 4. Artifact Sections (LedgerFlow Canvas)

    sections = [

        ArtifactSectionModel(

            id=f"{project_id}-sec-product_brief",

            project_id=project_id,

            section_key="product_brief",

            data={

                "target_audience": "Small businesses",

                "problem": "Manual, slow expense filing and receipt tracking",

                "value_proposition": "A simpler way for small teams to track spend and close books faster",

                "approved_decisions": [],

            },

            version=1,

            updated_by="system",

            updated_at=utcnow_str(),

        ),

        ArtifactSectionModel(

            id=f"{project_id}-sec-hero",

            project_id=project_id,

            section_key="hero",

            data={

                "headline": "Take control of company spending",

                "subheadline": "Real-time expense management for high-velocity teams",

                "cta_text": "Start Free Trial",

                "secondary_cta": "Book Demo",

                "badge": "LedgerFlow v1.0",

            },

            version=1,

            updated_by="system",

            updated_at=utcnow_str(),

        ),

        ArtifactSectionModel(

            id=f"{project_id}-sec-dashboard",

            project_id=project_id,

            section_key="dashboard",

            data={

                "title": "Finance Overview",

                "metrics": [

                    {"label": "Monthly Spend", "value": "$48,250", "change": "+12% vs last month", "trend": "up"},

                    {"label": "Pending Expenses", "value": "34", "change": "8 require attention", "trend": "neutral"},

                    {"label": "Active Cards", "value": "18", "change": "+3 this week", "trend": "up"},

                ],

                "categories": [

                    {"category": "Software & SaaS", "amount": "$24,100", "percentage": 50},

                    {"category": "Travel & Dining", "amount": "$14,500", "percentage": 30},

                    {"category": "Operations", "amount": "$9,650", "percentage": 20},

                ],

            },

            version=1,

            updated_by="system",

            updated_at=utcnow_str(),

        ),

        ArtifactSectionModel(

            id=f"{project_id}-sec-approval_queue",

            project_id=project_id,

            section_key="approval_queue",

            data={

                "title": "Expense Approval Queue",

                "policy_note": "Manager approval approach not yet finalised",

                "threshold": "$1,000",

                "items": [

                    {"id": "EXP-101", "submitter": "Sarah Chen", "department": "Engineering", "amount": "$1,240.00", "category": "Cloud Infrastructure", "policy_flag": None, "status": "pending"},

                    {"id": "EXP-102", "submitter": "Marcus Vance", "department": "Sales", "amount": "$4,800.00", "category": "Client Dinner", "policy_flag": "Over $1,000 threshold", "status": "escalated"},

                    {"id": "EXP-103", "submitter": "Elena Rostova", "department": "Design", "amount": "$350.00", "category": "Design Assets", "policy_flag": None, "status": "approved"},

                ],

            },

            version=1,

            updated_by="system",

            updated_at=utcnow_str(),

        ),

    ]

    db.add_all(sections)



    # Seed baseline requirement versions (Version 1)

    req_versions = [

        RequirementVersionModel(

            id=f"{r.id}-v{r.version}",

            project_id=r.project_id,

            requirement_key=r.requirement_key,

            title=r.title,

            value=r.value,

            version=r.version,

            status="approved",

            updated_by=r.updated_by,

            created_at=r.updated_at,

        )

        for r in requirements

    ]

    db.add_all(req_versions)



    # Seed baseline artifact section versions (Version 1)

    sec_versions = [

        ArtifactSectionVersionModel(

            id=f"{s.id}-v{s.version}",

            project_id=s.project_id,

            section_key=s.section_key,

            data=s.data,

            version=s.version,

            status="approved",

            updated_by=s.updated_by,

            created_at=s.updated_at,

        )

        for s in sections

    ]

    db.add_all(sec_versions)



    # 5. Baseline Agent Presence Runs (NOVA & PIXEL)

    now_str = utcnow_str()

    initial_runs = [

        AgentRunModel(

            id=f"{project_id}-run-nova-init",

            project_id=project_id,

            agent_id="nova",

            status="idle",

            lifecycle_state="idle",

            task_description="Analyze market positioning & requirement dependencies",

            context_pack={"requirements": [], "sections": {}},

            base_context_version=1,

            base_artifact_version=1,

            source="system_seed",

            last_heartbeat=now_str,

            current_task="Awaiting collaborative workflow dispatch",

            started_at=now_str,

        ),

        AgentRunModel(

            id=f"{project_id}-run-pixel-init",

            project_id=project_id,

            agent_id="pixel",

            status="idle",

            lifecycle_state="idle",

            task_description="Evolve LedgerFlow React components & approval queues",

            context_pack={"requirements": [], "sections": {}},

            base_context_version=1,

            base_artifact_version=1,

            source="system_seed",

            last_heartbeat=now_str,

            current_task="Awaiting collaborative workflow dispatch",

            started_at=now_str,

        ),

    ]

    db.add_all(initial_runs)



    # 6. Baseline Shared Creation Resources

    resources = [

        SharedResourceModel(

            id=f"res-{project_id}-proto-hero",

            project_id=project_id,

            resource_type="prototype",

            title="LedgerFlow Hero Prototype Section",

            description="Initial customer value proposition and high-converting CTA",

            creator_type="system",

            creator_id="system",

            data=sections[1].data,

            artifact_version=1,

            visibility="workspace",

        ),

        SharedResourceModel(

            id=f"res-{project_id}-proto-dashboard",

            project_id=project_id,

            resource_type="prototype",

            title="LedgerFlow Real-time Spend Dashboard",

            description="Operational telemetry and departmental breakdown matrix",

            creator_type="system",

            creator_id="system",

            data=sections[2].data,

            artifact_version=1,

            visibility="workspace",

        ),

        SharedResourceModel(

            id=f"res-{project_id}-proto-queue",

            project_id=project_id,

            resource_type="prototype",

            title="LedgerFlow Governance Approval Queue",

            description="Spend policy evaluation engine and multi-level manager queue",

            creator_type="system",

            creator_id="system",

            data=sections[3].data,

            artifact_version=1,

            visibility="workspace",

        ),

    ]

    db.add_all(resources)



    # 7. Baseline Event

    now_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)

    event = EventModel(

        id=f"evt-{now_ms}-init",

        sequence_no=1,

        project_id=project_id,

        workspace_id=project_id,

        actor_type="system",

        actor_id="system",

        event_type="workspace.initialized",

        entity_type="workspace",

        entity_id=project_id,

        context_version=1,

        artifact_version=1,

        payload={"message": "COFRAME workspace initialized with LedgerFlow baseline artifact and OpenAgents architecture capabilities."},

        timestamp=now_ms,

        created_at=now_str,

    )

    db.add(event)



    # 8. Seed Default Shared Team Conversation

    default_conv = ConversationModel(

        id="conv_team_ledgerflow",

        project_id=project_id,

        title="LedgerFlow Team Room",

        conversation_type="team_shared",

        created_by="alex",

        created_at=now_str,

        updated_at=now_str,

    )

    db.add(default_conv)



    conv_participants = [

        ConversationParticipantModel(

            id=f"part_{project_id}_alex",

            conversation_id="conv_team_ledgerflow",

            participant_id="alex",

            participant_type="human",

            joined_at=now_str,

            last_read_at=now_str,

        ),

        ConversationParticipantModel(

            id=f"part_{project_id}_maya",

            conversation_id="conv_team_ledgerflow",

            participant_id="maya",

            participant_type="human",

            joined_at=now_str,

            last_read_at=now_str,

        ),

        ConversationParticipantModel(

            id=f"part_{project_id}_nova",

            conversation_id="conv_team_ledgerflow",

            participant_id="nova",

            participant_type="agent",

            joined_at=now_str,

            last_read_at=now_str,

        ),

        ConversationParticipantModel(

            id=f"part_{project_id}_pixel",

            conversation_id="conv_team_ledgerflow",

            participant_id="pixel",

            participant_type="agent",

            joined_at=now_str,

            last_read_at=now_str,

        ),

    ]

    db.add_all(conv_participants)



    init_messages = [

        ChatMessageModel(

            id="msg_init_alex",

            conversation_id="conv_team_ledgerflow",

            sender_id="alex",

            sender_type="human",

            recipient_id="team",

            recipient_type="team",

            message_content="Welcome to LedgerFlow. NOVA and PIXEL, our initial focus is small business spend management, moving towards enterprise governance.",

            message_type="human_message",

            status="delivered",

            created_at=now_str,

        ),

        ChatMessageModel(

            id="msg_init_nova",

            conversation_id="conv_team_ledgerflow",

            sender_id="nova",

            sender_type="agent",

            recipient_id="team",

            recipient_type="team",

            message_content="Understood Alex. I've formulated our baseline audience positioning and core metrics requirements. Ready to explore new product ideas or expand enterprise requirements.",

            message_type="agent_message",

            status="delivered",

            created_at=now_str,

        ),

        ChatMessageModel(

            id="msg_init_pixel",

            conversation_id="conv_team_ledgerflow",

            sender_id="pixel",

            sender_type="agent",

            recipient_id="team",

            recipient_type="team",

            message_content="LedgerFlow prototype canvas initialized. Ready to implement UI sections and approval workflows upon confirmed requirements.",

            message_type="agent_message",

            status="delivered",

            created_at=now_str,

        ),

    ]

    db.add_all(init_messages)



    db.commit()

    return project

