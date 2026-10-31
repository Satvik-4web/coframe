from typing import Dict, Any, List

# Deterministic Known-Good Fallback Outputs matching Section 2.2 & Section 6 of Specification

FALLBACK_NOVA_PROPOSAL_A = {
    "summary": "Position LedgerFlow for small-business finance agility",
    "reasoning": "Based on REQ_AUDIENCE (Small businesses), positioning should emphasize effortless receipt capture and fast book closing without enterprise overhead.",
    "affected_requirements": ["REQ_AUDIENCE"],
    "target_sections": ["product_brief"],
    "changes": {
        "operations": [
            {
                "op": "update_product_brief",
                "fields": {
                    "target_audience": "Small businesses & fast-growing startups (1-50 employees)",
                    "value_proposition": "Frictionless expense tracking and automated categorization built specifically for nimble small business teams.",
                    "problem": "Manual expense reports consume 12+ hours per month for small business owners and finance leads.",
                },
            }
        ]
    },
}

FALLBACK_NOVA_PROPOSAL_B = {
    "summary": "Introduce real-time spend analytics and category breakdown",
    "reasoning": "Fulfills REQ_METRICS by providing instant visibility into monthly burn, recurring SaaS spend, and pending reimbursements.",
    "affected_requirements": ["REQ_METRICS"],
    "target_sections": ["dashboard"],
    "changes": {
        "operations": [
            {
                "op": "set_dashboard_metrics",
                "title": "Real-Time Company Financial Health",
                "metrics": [
                    {"label": "Monthly Spend", "value": "$54,120", "change": "+8.4% MoM", "trend": "up"},
                    {"label": "Pending Expenses", "value": "19", "change": "5 urgent (> $500)", "trend": "neutral"},
                    {"label": "Active Cards", "value": "24", "change": "+6 new issued", "trend": "up"},
                    {"label": "Avg Approval Time", "value": "2.4 hrs", "change": "-45% this quarter", "trend": "up"},
                ],
                "categories": [
                    {"category": "Cloud Infrastructure", "amount": "$28,400", "percentage": 52},
                    {"category": "Sales & Travel", "amount": "$16,220", "percentage": 30},
                    {"category": "Office & Supplies", "amount": "$9,500", "percentage": 18},
                ],
            }
        ]
    },
}

FALLBACK_PIXEL_PROPOSAL_C = {
    "summary": "High-conversion hero header with intuitive expense submission CTA",
    "reasoning": "Aligns with REQ_BRAND to deliver clean, approachable messaging with an unmistakable primary action.",
    "affected_requirements": ["REQ_BRAND"],
    "target_sections": ["hero"],
    "changes": {
        "operations": [
            {
                "op": "set_hero_content",
                "fields": {
                    "headline": "Modern Expense Control, Zero Friction",
                    "subheadline": "Empower your team to submit receipts in seconds while finance retains full visibility and instant card controls.",
                    "cta_text": "Start Free 14-Day Trial",
                    "secondary_cta": "Watch 2-Min Demo",
                    "badge": "Designed for Agile Teams",
                },
            }
        ]
    },
}

FALLBACK_HIGH_IMPACT_APPROVAL_POLICY = {
    "summary": "Enterprise Tiered Approval Matrix with $1,000 threshold",
    "reasoning": "Enterprise operations require strict role-based delegation. All expenditures exceeding $1,000 require VP or Finance Director signoff.",
    "affected_requirements": ["REQ_APPROVAL_POLICY", "REQ_ROLES"],
    "target_sections": ["approval_queue"],
    "changes": {
        "operations": [
            {
                "op": "set_approval_queue_config",
                "config": {
                    "title": "Enterprise Multi-Tier Approval Queue",
                    "policy_note": "Expenses <= $1,000 auto-route to direct manager; expenses > $1,000 escalate to VP Finance.",
                    "threshold": "$1,000.00",
                },
                "items": [
                    {"id": "EXP-201", "submitter": "Sarah Chen", "department": "Engineering", "amount": "$1,450.00", "category": "Datadog Monitoring", "policy_flag": "Requires VP Signoff (> $1,000)", "status": "pending"},
                    {"id": "EXP-202", "submitter": "David Kim", "department": "Security", "amount": "$890.00", "category": "YubiKey Batch Order", "policy_flag": "Standard Manager Review", "status": "pending"},
                    {"id": "EXP-203", "submitter": "Marcus Vance", "department": "Enterprise Sales", "amount": "$6,200.00", "category": "Q4 Executive Dinner", "policy_flag": "Escalated: High Value (> $5,000)", "status": "escalated"},
                    {"id": "EXP-204", "submitter": "Elena Rostova", "department": "Product Design", "amount": "$350.00", "category": "Figma Enterprise Seat", "policy_flag": "Auto-Approved within Dept Limit", "status": "approved"},
                ],
            }
        ]
    },
}

FALLBACK_RECONCILED_PROPOSAL_A = {
    "summary": "Enterprise-grade positioning tailored for Global Finance & Controllers",
    "reasoning": "Reconciled with updated REQ_AUDIENCE (Enterprise finance teams) and manager expense approvals. Emphasizes compliance, ERP integrations, and multi-entity controls.",
    "affected_requirements": ["REQ_AUDIENCE", "REQ_APPROVAL_POLICY"],
    "target_sections": ["product_brief"],
    "changes": {
        "operations": [
            {
                "op": "update_product_brief",
                "fields": {
                    "target_audience": "Mid-market & Global Enterprise Finance Organizations (250-10,000+ employees)",
                    "value_proposition": "Comprehensive spend governance, multi-subsidiary controls, and enterprise ERP sync for modern corporate controllers.",
                    "problem": "Uncontrolled corporate card spend, audit non-compliance, and sluggish multi-tier manager approval chains across distributed business units.",
                },
            }
        ]
    },
}

FALLBACK_REDIRECTED_PROPOSAL_D = {
    "summary": "Configurable Per-Organization Approval Policy Matrix",
    "reasoning": "Revised per Alex's redirect note ('Make approval thresholds configurable per organisation'). Added flexible policy boundaries and tiered routing per department.",
    "affected_requirements": ["REQ_APPROVAL_POLICY", "REQ_ROLES"],
    "target_sections": ["approval_queue"],
    "changes": {
        "operations": [
            {
                "op": "set_approval_queue_config",
                "config": {
                    "title": "Organization-Configurable Approval Routing Engine",
                    "policy_note": "Configurable per Org: Custom thresholds per subsidiary with dynamic manager-to-controller routing rules.",
                    "threshold": "Custom Org-defined ($500 - $10,000)",
                },
                "items": [
                    {"id": "EXP-301", "submitter": "Sarah Chen", "department": "Engineering Core", "amount": "$2,200.00", "category": "AWS Reserved Instances", "policy_flag": "Org Rule: Eng Budget Tier 2", "status": "pending"},
                    {"id": "EXP-302", "submitter": "Marcus Vance", "department": "Strategic Accounts", "amount": "$4,500.00", "category": "Client Hospitality", "policy_flag": "Org Rule: Sales Threshold Met", "status": "pending"},
                    {"id": "EXP-303", "submitter": "Finance Admin", "department": "Treasury", "amount": "$9,800.00", "category": "Audit & Compliance Service", "policy_flag": "Executive Committee Signoff", "status": "escalated"},
                ],
            }
        ]
    },
}
