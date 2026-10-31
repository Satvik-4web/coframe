import uuid
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.app.db.database import get_db
from backend.app.db.models import (
    ConversationModel,
    ConversationParticipantModel,
    ChatMessageModel,
    ProposalModel,
    ProjectModel,
    ProjectMemberModel,
    utcnow_str,
)
from backend.app.agents.chat_service import (
    dispatch_chat_message,
    serialize_chat_message,
)
from backend.app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])


class CreateConversationRequest(BaseModel):
    title: str
    conversation_type: str = "team_shared"  # "team_shared", "direct_nova", "direct_pixel"
    created_by: str = "alex"
    participants: Optional[List[str]] = None
    associated_task_id: Optional[str] = None


class SendChatMessageRequest(BaseModel):
    sender_id: str  # "alex" or "maya"
    message_content: str
    recipient: str = "team"  # "nova", "pixel", "team"
    related_task_id: Optional[str] = None


class MarkReadRequest(BaseModel):
    participant_id: str


@router.get("/projects/{project_id}/conversations")
async def list_conversations(project_id: str, db: Session = Depends(get_db)):
    """Lists all persistent conversations for the project."""
    convs = (
        db.query(ConversationModel)
        .filter(ConversationModel.project_id == project_id)
        .order_by(ConversationModel.updated_at.desc())
        .all()
    )

    results = []
    for c in convs:
        # Get participants
        parts = (
            db.query(ConversationParticipantModel)
            .filter(ConversationParticipantModel.conversation_id == c.id)
            .all()
        )
        # Get last message
        last_msg = (
            db.query(ChatMessageModel)
            .filter(ChatMessageModel.conversation_id == c.id)
            .order_by(ChatMessageModel.created_at.desc())
            .first()
        )
        msg_count = (
            db.query(ChatMessageModel)
            .filter(ChatMessageModel.conversation_id == c.id)
            .count()
        )

        results.append({
            "id": c.id,
            "project_id": c.project_id,
            "title": c.title,
            "conversation_type": c.conversation_type,
            "associated_task_id": c.associated_task_id,
            "created_by": c.created_by,
            "created_at": c.created_at,
            "updated_at": c.updated_at,
            "message_count": msg_count,
            "last_message": serialize_chat_message(last_msg) if last_msg else None,
            "participants": [
                {
                    "participant_id": p.participant_id,
                    "participant_type": p.participant_type,
                    "joined_at": p.joined_at,
                    "last_read_at": p.last_read_at,
                }
                for p in parts
            ],
        })

    return results


@router.post("/projects/{project_id}/conversations")
async def create_conversation(
    project_id: str,
    body: CreateConversationRequest,
    db: Session = Depends(get_db),
):
    """Creates a new persistent conversation."""
    creator_clean = body.created_by.strip().lower()
    if creator_clean not in ("alex", "maya"):
        raise HTTPException(
            status_code=403,
            detail=f"Unauthorized creator '{body.created_by}'. Only 'alex' or 'maya' may create conversations.",
        )

    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    conv_id = f"conv_{uuid.uuid4().hex[:10]}"
    now_str = utcnow_str()

    conversation = ConversationModel(
        id=conv_id,
        project_id=project_id,
        title=body.title.strip(),
        conversation_type=body.conversation_type,
        associated_task_id=body.associated_task_id,
        created_by=creator_clean,
        created_at=now_str,
        updated_at=now_str,
    )
    db.add(conversation)

    # Participants
    target_participants = body.participants or ["alex", "maya", "nova", "pixel"]
    for pid in target_participants:
        ptype = "human" if pid in ("alex", "maya") else "agent"
        part = ConversationParticipantModel(
            id=f"part_{uuid.uuid4().hex[:8]}",
            conversation_id=conv_id,
            participant_id=pid,
            participant_type=ptype,
            joined_at=now_str,
            last_read_at=now_str,
        )
        db.add(part)

    db.commit()
    db.refresh(conversation)

    await ws_manager.broadcast(project_id, {
        "type": "CONVERSATION_CREATED",
        "conversation_id": conversation.id,
        "title": conversation.title,
    })

    return {
        "id": conversation.id,
        "project_id": conversation.project_id,
        "title": conversation.title,
        "conversation_type": conversation.conversation_type,
        "created_by": conversation.created_by,
        "created_at": conversation.created_at,
    }


@router.get("/projects/{project_id}/conversations/{conversation_id}")
async def get_conversation(
    project_id: str,
    conversation_id: str,
    db: Session = Depends(get_db),
):
    """Retrieves conversation details and participants."""
    conv = (
        db.query(ConversationModel)
        .filter(ConversationModel.id == conversation_id, ConversationModel.project_id == project_id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    parts = (
        db.query(ConversationParticipantModel)
        .filter(ConversationParticipantModel.conversation_id == conv.id)
        .all()
    )

    return {
        "id": conv.id,
        "project_id": conv.project_id,
        "title": conv.title,
        "conversation_type": conv.conversation_type,
        "associated_task_id": conv.associated_task_id,
        "created_by": conv.created_by,
        "created_at": conv.created_at,
        "updated_at": conv.updated_at,
        "participants": [
            {
                "participant_id": p.participant_id,
                "participant_type": p.participant_type,
                "joined_at": p.joined_at,
                "last_read_at": p.last_read_at,
            }
            for p in parts
        ],
    }


@router.get("/projects/{project_id}/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    project_id: str,
    conversation_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Retrieves messages for a conversation in chronological order."""
    messages = (
        db.query(ChatMessageModel)
        .filter(ChatMessageModel.conversation_id == conversation_id)
        .order_by(ChatMessageModel.created_at.asc())
        .limit(limit)
        .all()
    )

    # Collect proposal objects for messages with related proposals
    prop_ids = [m.related_proposal_id for m in messages if m.related_proposal_id]
    proposals_map = {}
    if prop_ids:
        props = db.query(ProposalModel).filter(ProposalModel.id.in_(prop_ids)).all()
        proposals_map = {p.id: p for p in props}

    return [
        serialize_chat_message(m, proposals_map.get(m.related_proposal_id))
        for m in messages
    ]


@router.post("/projects/{project_id}/conversations/{conversation_id}/messages")
async def send_message(
    project_id: str,
    conversation_id: str,
    body: SendChatMessageRequest,
    db: Session = Depends(get_db),
):
    """Sends a human message and dispatches it to the recipient agent."""
    if not body.message_content.strip():
        raise HTTPException(status_code=400, detail="Message content cannot be empty.")

    sender_clean = body.sender_id.strip().lower()
    if sender_clean not in ("alex", "maya"):
        raise HTTPException(
            status_code=403,
            detail=f"Unauthorized sender '{body.sender_id}'. Only 'alex' or 'maya' may send messages.",
        )

    try:
        human_msg, agent_responses = await dispatch_chat_message(
            db=db,
            project_id=project_id,
            conversation_id=conversation_id,
            sender_id=sender_clean,
            recipient=body.recipient,
            message_content=body.message_content.strip(),
            related_task_id=body.related_task_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error dispatching chat message: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process chat message: {e}")

    serialized_responses = []
    for r in agent_responses:
        prop = None
        if r.related_proposal_id:
            prop = db.query(ProposalModel).filter(ProposalModel.id == r.related_proposal_id).first()
        serialized_responses.append(serialize_chat_message(r, prop))

    return {
        "status": "success",
        "human_message": serialize_chat_message(human_msg),
        "agent_responses": serialized_responses,
    }


@router.post("/projects/{project_id}/conversations/{conversation_id}/read")
async def mark_conversation_read(
    project_id: str,
    conversation_id: str,
    body: MarkReadRequest,
    db: Session = Depends(get_db),
):
    """Marks conversation read for a participant."""
    part = (
        db.query(ConversationParticipantModel)
        .filter(
            ConversationParticipantModel.conversation_id == conversation_id,
            ConversationParticipantModel.participant_id == body.participant_id.lower(),
        )
        .first()
    )
    if part:
        part.last_read_at = utcnow_str()
        db.commit()

    return {"status": "ok"}
