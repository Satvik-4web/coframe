import datetime
from sqlalchemy.orm import Session
from backend.app.db.database import Base, engine
from backend.app.db.models import (
    ProjectModel,
    ProjectMemberModel,
    RequirementModel,
    ArtifactSectionModel,
    EventModel,
    AgentRunModel,
    ProposalModel,
    DecisionModel,
    GitHubConnectionModel,
    GitHubContributionModel,
    GitHubSyncJobModel,
    utcnow_str,
)

DEMO_PROJECT_ID = "demo-ledgerflow"


def init_db():
    Base.metadata.create_all(bind=engine)


def reset_demo_database(db: Session, project_id: str = DEMO_PROJECT_ID):
    """Deterministically wipes and resets the project to the exact baseline defined in the specification."""
    init_db()

    # Clear existing demo records
    db.query(GitHubSyncJobModel).filter(GitHubSyncJobModel.project_id == project_id).delete(synchronize_session=False)
    db.query(GitHubContributionModel).filter(GitHubContributionModel.project_id == project_id).delete(synchronize_session=False)
    db.query(GitHubConnectionModel).filter(GitHubConnectionModel.project_id == project_id).delete(synchronize_session=False)

    db.query(DecisionModel).filter(DecisionModel.proposal_id.in_(
        db.query(ProposalModel.id).filter(ProposalModel.project_id == project_id)
    )).delete(synchronize_session=False)

    db.query(ProposalModel).filter(ProposalModel.project_id == project_id).delete(synchronize_session=False)
    db.query(AgentRunModel).filter(AgentRunModel.project_id == project_id).delete(synchronize_session=False)
    db.query(EventModel).filter(EventModel.project_id == project_id).delete(synchronize_session=False)
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

    # 5. Baseline Event
    event = EventModel(
        id=f"evt-{datetime.datetime.now(datetime.timezone.utc).timestamp():.0f}-init",
        sequence_no=1,
        project_id=project_id,
        actor_type="system",
        actor_id="system",
        event_type="PROJECT_INITIALIZED",
        context_version=1,
        artifact_version=1,
        payload={"message": "COFRAME workspace initialized with LedgerFlow baseline artifact."},
        created_at=utcnow_str(),
    )
    db.add(event)

    db.commit()
    return project
