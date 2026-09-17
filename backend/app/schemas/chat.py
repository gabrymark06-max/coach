"""Chat (design-system §9.7) ed eventi di prodotto."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.common import Note


class ParagraphBlock(BaseModel):
    type: Literal["paragraph"]
    text: str = Field(description="Apici marcati con [[n]]")


class OptionItem(BaseModel):
    id: str
    label: str
    description: str | None = None
    is_pro: bool = False
    chosen: bool = False


class OptionsBlock(BaseModel):
    type: Literal["options"]
    options: list[OptionItem]


class PlanChangeDiffItem(BaseModel):
    exercise: str
    field: str
    from_value: Any = Field(alias="from")
    to_value: Any = Field(alias="to")
    note_n: int | None = None

    model_config = {"populate_by_name": True}


class PlanChangeBlock(BaseModel):
    type: Literal["plan_change"]
    proposal_id: uuid.UUID
    diff: list[PlanChangeDiffItem]
    applied: bool | None = Field(description="null = in attesa; true = applicata; false = rifiutata o non valida")
    valid: bool = True
    invalid_reason_it: str | None = None


class SafetyBlock(BaseModel):
    type: Literal["safety"]
    text: str
    options: list[OptionItem]


class PaywallBlock(BaseModel):
    type: Literal["paywall"]
    surface: Literal["chat_quota", "maintenance_request"]
    context_line: str
    resets_at: datetime | None = None


Block = ParagraphBlock | OptionsBlock | PlanChangeBlock | SafetyBlock | PaywallBlock


class ChatMessageOut(BaseModel):
    id: uuid.UUID
    role: Literal["coach", "user"]
    kind: Literal["user_turn", "proactive", "safety", "paywall"]
    at: datetime
    status: Literal["sent", "failed"]
    protocol: str | None = None
    blocks: list[Block]
    notes: list[Note]
    reply_to_id: uuid.UUID | None = None


class ChatSendIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    client_op_id: str = Field(min_length=1, max_length=64)


class ChatQuotaOut(BaseModel):
    used: int
    limit: int
    resets_at: datetime
    daily_used: int | None = None
    daily_limit: int | None = None
    exhausted: bool


class ChatOptionIn(BaseModel):
    message_id: uuid.UUID = Field(description="Il messaggio del coach che contiene le opzioni")


class ChatTextsOut(BaseModel):
    ai_badge_text: str
    ai_badge_note: Note
    paywall_context_line: dict[str, str] = Field(description="per superficie: end_of_block | chat_quota | maintenance_request")
    support_email: str = Field(description="v1.1: l'email di supporto pubblica (footer, /prezzi), la stessa di GET /me")


class EventIn(BaseModel):
    name: Literal["install_prompt_shown", "installed", "paywall_shown", "checkout_started"]
    props: dict[str, Any] = Field(default_factory=dict)


class EventOut(BaseModel):
    id: uuid.UUID
    name: str
    props: dict[str, Any]
    source: str
    at: datetime
