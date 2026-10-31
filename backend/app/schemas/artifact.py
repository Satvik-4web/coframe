from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ProductBriefData(BaseModel):
    target_audience: str = "Small businesses"
    problem: str = "Manual, slow expense filing and receipt tracking"
    value_proposition: str = "A simpler way for small teams to track spend and close books faster"
    approved_decisions: List[str] = Field(default_factory=list)


class HeroSectionData(BaseModel):
    headline: str = "Take control of company spending"
    subheadline: str = "Real-time expense management for high-velocity teams"
    cta_text: str = "Start Free Trial"
    secondary_cta: Optional[str] = "Book Demo"
    badge: Optional[str] = "LedgerFlow v1.0"


class MetricCard(BaseModel):
    label: str
    value: str
    change: Optional[str] = None
    trend: Optional[str] = "up"  # "up" | "down" | "neutral"


class SpendCategory(BaseModel):
    category: str
    amount: str
    percentage: int


class DashboardSectionData(BaseModel):
    title: str = "Finance Overview"
    metrics: List[MetricCard] = Field(
        default_factory=lambda: [
            MetricCard(label="Monthly Spend", value="$48,250", change="+12% vs last month", trend="up"),
            MetricCard(label="Pending Expenses", value="34", change="8 require attention", trend="neutral"),
            MetricCard(label="Active Cards", value="18", change="+3 this week", trend="up"),
        ]
    )
    categories: List[SpendCategory] = Field(
        default_factory=lambda: [
            SpendCategory(category="Software & SaaS", amount="$24,100", percentage=50),
            SpendCategory(category="Travel & Dining", amount="$14,500", percentage=30),
            SpendCategory(category="Operations", amount="$9,650", percentage=20),
        ]
    )


class ApprovalQueueItem(BaseModel):
    id: str
    submitter: str
    department: str
    amount: str
    category: str
    policy_flag: Optional[str] = None
    status: str = "pending"  # "pending" | "approved" | "rejected" | "escalated"


class ApprovalQueueSectionData(BaseModel):
    title: str = "Expense Approval Queue"
    policy_note: Optional[str] = "Manager approval approach not yet finalised"
    threshold: Optional[str] = None
    items: List[ApprovalQueueItem] = Field(
        default_factory=lambda: [
            ApprovalQueueItem(id="EXP-101", submitter="Sarah Chen", department="Engineering", amount="$1,240.00", category="Cloud Infrastructure", policy_flag=None, status="pending"),
            ApprovalQueueItem(id="EXP-102", submitter="Marcus Vance", department="Sales", amount="$4,800.00", category="Client Dinner", policy_flag="Over $1,000 threshold", status="escalated"),
            ApprovalQueueItem(id="EXP-103", submitter="Elena Rostova", department="Design", amount="$350.00", category="Design Assets", policy_flag=None, status="approved"),
        ]
    )


class SectionState(BaseModel):
    section_key: str
    data: Dict[str, Any]
    version: int
    updated_by: str
    updated_at: str


class FullArtifactState(BaseModel):
    project_id: str
    artifact_version: int
    sections: Dict[str, SectionState]


class ManualSectionEditRequest(BaseModel):
    expected_version: int
    data: Dict[str, Any]
    editor_id: str = "maya"  # 'alex' or 'maya'
