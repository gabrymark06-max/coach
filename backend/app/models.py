"""Modello dati. Un solo file: le relazioni si leggono meglio insieme.

Scelte non ovvie (motivate in docs/api-contract.md):
- `session_sets` porta insieme target e log: l'idempotenza per `client_op_id` vive sulla riga.
- `entitlements` è una riga per utente, letta da un solo predicato `is_pro(user, now)`.
- `rules`/`citations` sono dati versionati: il chip di fonte è una join, mai una generazione.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

EMBEDDING_DIM = 1536


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class Base(DeclarativeBase):
    type_annotation_map = {dict: JSONB, list: JSONB}


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


# ---------------------------------------------------------------- identità


class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pwa_installed_reported: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(64), unique=True)

    profile: Mapped[Profile | None] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    entitlement: Mapped[Entitlement | None] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class OneTimeToken(Base):
    """Verifica email e reset password. Hash del token, mai il token."""

    __tablename__ = "one_time_tokens"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    purpose: Mapped[str] = mapped_column(String(32), nullable=False)  # verify_email | reset_password
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Profile(Base, TimestampMixin):
    __tablename__ = "profiles"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    goal: Mapped[str] = mapped_column(String(16), nullable=False)  # hypertrophy | strength | health
    level: Mapped[str] = mapped_column(String(16), nullable=False)  # beginner | intermediate
    days_per_week: Mapped[int] = mapped_column(Integer, nullable=False)
    minutes_per_session: Mapped[int] = mapped_column(Integer, nullable=False)
    location: Mapped[str] = mapped_column(String(16), nullable=False)  # gym | home_dumbbells | bodyweight
    equipment: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    # Dati art. 9 GDPR: esistono solo con consenso separato; la revoca li azzera.
    health_consent_given: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    health_consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    constraints_text: Mapped[str | None] = mapped_column(Text)
    avoid_patterns: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    # Gate di sicurezza proprio (non PAR-Q+)
    safety_answers: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    safety_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    conservative: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="profile")


# ---------------------------------------------------------------- conoscenza


class Citation(Base):
    __tablename__ = "citations"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)  # cit_0001
    doi: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    authors: Mapped[str] = mapped_column(String(512), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    journal: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)  # meta_analysis | rct | guideline | position_stand | review | consensus | preprint
    open_access: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    url: Mapped[str] = mapped_column(String(512), nullable=False)
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified_title: Mapped[str] = mapped_column(Text, nullable=False)
    verified_via: Mapped[str] = mapped_column(String(32), nullable=False)  # crossref


class Rule(Base):
    __tablename__ = "rules"
    id: Mapped[str] = mapped_column(String(96), primary_key=True)  # volume.hypertrophy.intermediate.weekly_sets
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    governs: Mapped[str] = mapped_column(String(255), nullable=False)
    applies_to: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    value: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    grade: Mapped[str | None] = mapped_column(String(1))  # A | B | C | null
    citation_ids: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    title_it: Mapped[str] = mapped_column(String(80), nullable=False)
    summary_it: Mapped[str] = mapped_column(Text, nullable=False)
    not_says_it: Mapped[str] = mapped_column(Text, nullable=False)
    is_own_note: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    rationale_it: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[date] = mapped_column(Date, nullable=False)


class Exercise(Base):
    __tablename__ = "exercises"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # slug
    name_it: Mapped[str] = mapped_column(String(120), nullable=False)
    name_en: Mapped[str] = mapped_column(String(120), nullable=False)
    pattern: Mapped[str] = mapped_column(String(24), nullable=False)
    primary_muscle: Mapped[str] = mapped_column(String(24), nullable=False)
    secondary_muscles: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    equipment: Mapped[str] = mapped_column(String(24), nullable=False)  # barbell | dumbbell | machine | cable | bodyweight
    mechanic: Mapped[str] = mapped_column(String(12), nullable=False)  # compound | isolation
    spinal_load: Mapped[str] = mapped_column(String(8), nullable=False, default="low")  # high | low
    min_tier: Mapped[str] = mapped_column(String(16), nullable=False, default="beginner")
    requires: Mapped[str | None] = mapped_column(String(24))  # es. pull_up_bar
    instructions_it: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    gif_url: Mapped[str | None] = mapped_column(String(512))
    poster_url: Mapped[str | None] = mapped_column(String(512))
    attribution: Mapped[str | None] = mapped_column(String(255))
    source: Mapped[str] = mapped_column(String(64), nullable=False)


class CorpusChunk(Base):
    __tablename__ = "corpus_chunks"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # doc.section
    doc_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(24), nullable=False)  # citation_summary | exercise | protocol | safety
    title_it: Mapped[str] = mapped_column(String(200), nullable=False)
    text_it: Mapped[str] = mapped_column(Text, nullable=False)
    citation_ids: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    rule_ids: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    embedding: Mapped[list | None] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)


# ---------------------------------------------------------------- piano


class Mesocycle(Base, TimestampMixin):
    __tablename__ = "mesocycles"
    __table_args__ = (UniqueConstraint("user_id", "index", name="uq_mesocycle_user_index"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    index: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")  # active | maintenance | completed
    split: Mapped[str] = mapped_column(String(16), nullable=False)  # full_body | upper_lower | ppl
    tier: Mapped[str] = mapped_column(String(16), nullable=False)  # beginner | intermediate | health
    total_weeks: Mapped[int] = mapped_column(Integer, nullable=False)
    started_on: Mapped[date] = mapped_column(Date, nullable=False)
    engine_version: Mapped[str] = mapped_column(String(16), nullable=False)
    rules_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)  # rule_id -> version
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    summary_shown_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    weeks: Mapped[list[PlanWeek]] = relationship(
        back_populates="mesocycle", cascade="all, delete-orphan", order_by="PlanWeek.n"
    )


class PlanWeek(Base):
    __tablename__ = "plan_weeks"
    __table_args__ = (UniqueConstraint("mesocycle_id", "n", name="uq_week_meso_n"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    mesocycle_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("mesocycles.id", ondelete="CASCADE"), index=True, nullable=False
    )
    n: Mapped[int] = mapped_column(Integer, nullable=False)
    is_deload: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_maintenance: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    label_it: Mapped[str] = mapped_column(String(80), nullable=False)
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    changes: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)  # [{text, rule_id}]

    mesocycle: Mapped[Mesocycle] = relationship(back_populates="weeks")
    sessions: Mapped[list[PlannedSession]] = relationship(
        back_populates="week", cascade="all, delete-orphan", order_by="PlannedSession.index_in_week"
    )


class PlannedSession(Base):
    __tablename__ = "planned_sessions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    mesocycle_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("mesocycles.id", ondelete="CASCADE"), index=True, nullable=False
    )
    week_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plan_weeks.id", ondelete="CASCADE"), index=True, nullable=False)
    week_n: Mapped[int] = mapped_column(Integer, nullable=False)
    index_in_week: Mapped[int] = mapped_column(Integer, nullable=False)
    sessions_in_week: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    template_key: Mapped[str] = mapped_column(String(24), nullable=False)  # full_a, upper_1, push...
    date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="planned")  # planned | done | short | skipped
    est_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    short_version: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    close_line: Mapped[str | None] = mapped_column(Text)
    # versione "client": max(client_updated_at) delle scritture applicate — serve alla bozza offline
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    missed_email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    no_day_message_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    week: Mapped[PlanWeek] = relationship(back_populates="sessions")
    exercises: Mapped[list[PlannedExercise]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="PlannedExercise.order"
    )
    readiness: Mapped[ReadinessCheck | None] = relationship(
        back_populates="session", uselist=False, cascade="all, delete-orphan"
    )


Index("ix_planned_sessions_user_date", PlannedSession.user_id, PlannedSession.date)


class PlannedExercise(Base):
    __tablename__ = "planned_exercises"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("planned_sessions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    exercise_id: Mapped[str] = mapped_column(ForeignKey("exercises.id"), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    slot_pattern: Mapped[str] = mapped_column(String(24), nullable=False)
    sets: Mapped[int] = mapped_column(Integer, nullable=False)
    reps_min: Mapped[int] = mapped_column(Integer, nullable=False)
    reps_max: Mapped[int] = mapped_column(Integer, nullable=False)
    rest_s: Mapped[int] = mapped_column(Integer, nullable=False)
    rir_target: Mapped[int] = mapped_column(Integer, nullable=False)
    rule_refs: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)  # {sets, reps, rest, rir, selection}
    substituted_from_id: Mapped[str | None] = mapped_column(ForeignKey("exercises.id"))
    removed_today: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    removed_reason_it: Mapped[str | None] = mapped_column(String(200))
    removed_rule_id: Mapped[str | None] = mapped_column(String(96))
    changed_today_label_it: Mapped[str | None] = mapped_column(String(120))
    skipped: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    original: Mapped[dict | None] = mapped_column(JSONB)  # snapshot prima della readiness, per "Rimettilo"

    session: Mapped[PlannedSession] = relationship(back_populates="exercises")
    exercise: Mapped[Exercise] = relationship(foreign_keys=[exercise_id], lazy="joined")
    substituted_from: Mapped[Exercise | None] = relationship(foreign_keys=[substituted_from_id], lazy="joined")
    set_rows: Mapped[list[SessionSet]] = relationship(
        back_populates="planned_exercise", cascade="all, delete-orphan", order_by="SessionSet.n"
    )


class SessionSet(Base):
    """Target e log sulla stessa riga: la seduta è un oggetto solo, la bozza offline lo riscrive per riga."""

    __tablename__ = "session_sets"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    planned_exercise_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("planned_exercises.id", ondelete="CASCADE"), index=True, nullable=False
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("planned_sessions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    n: Mapped[int] = mapped_column(Integer, nullable=False)
    target_weight_kg: Mapped[float | None] = mapped_column(Numeric(6, 2))
    target_reps: Mapped[int] = mapped_column(Integer, nullable=False)
    target_rir: Mapped[int] = mapped_column(Integer, nullable=False)
    logged_weight_kg: Mapped[float | None] = mapped_column(Numeric(6, 2))
    logged_reps: Mapped[int | None] = mapped_column(Integer)
    logged_rir: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(8), nullable=False, default="todo")  # todo | done | skipped
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    client_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    planned_exercise: Mapped[PlannedExercise] = relationship(back_populates="set_rows")


class SetOp(Base):
    """Registro di idempotenza delle scritture sulla seduta."""

    __tablename__ = "session_ops"
    __table_args__ = (UniqueConstraint("session_id", "client_op_id", name="uq_session_op"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("planned_sessions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    client_op_id: Mapped[str] = mapped_column(String(64), nullable=False)
    op: Mapped[str] = mapped_column(String(24), nullable=False)
    result: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ReadinessCheck(Base):
    __tablename__ = "readiness_checks"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("planned_sessions.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    sleep: Mapped[str] = mapped_column(String(8), nullable=False)
    mood: Mapped[str] = mapped_column(String(8), nullable=False)
    pain: Mapped[str] = mapped_column(String(8), nullable=False)
    short_version: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    override: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    diff: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session: Mapped[PlannedSession] = relationship(back_populates="readiness")


class PlanChangeProposal(Base):
    __tablename__ = "plan_change_proposals"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    mesocycle_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("mesocycles.id", ondelete="CASCADE"), nullable=False)
    message_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    origin: Mapped[str] = mapped_column(String(16), nullable=False)  # user | coach
    patch: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    diff: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False)  # proposed | accepted | rejected | invalid
    invalid_reason_it: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# ---------------------------------------------------------------- chat


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (UniqueConstraint("user_id", "client_op_id", name="uq_chat_client_op"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(8), nullable=False)  # coach | user
    kind: Mapped[str] = mapped_column(String(12), nullable=False)  # user_turn | proactive | safety | paywall
    status: Mapped[str] = mapped_column(String(8), nullable=False, default="sent")  # sent | failed
    text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    blocks: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    notes: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    protocol: Mapped[str | None] = mapped_column(String(24))  # no_day | second_skip | return_after_break | plan_comment | block_summary
    client_op_id: Mapped[str | None] = mapped_column(String(64))
    reply_to_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


Index("ix_chat_messages_user_created", ChatMessage.user_id, ChatMessage.created_at)


class LlmUsage(Base):
    __tablename__ = "llm_usage"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    message_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    model: Mapped[str] = mapped_column(String(64), nullable=False)
    turn_kind: Mapped[str] = mapped_column(String(12), nullable=False)  # user_turn | proactive | safety
    tokens_in: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tokens_cache_read: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tokens_cache_write: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost_usd: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False, default=0)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# ---------------------------------------------------------------- soldi


class Entitlement(Base):
    __tablename__ = "entitlements"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    plan: Mapped[str] = mapped_column(String(8), nullable=False, default="free")  # free | pro
    source: Mapped[str] = mapped_column(String(8), nullable=False, default="none")  # stripe | promo | manual | none
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    grace_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="entitlement")


class Subscription(Base, TimestampMixin):
    __tablename__ = "subscriptions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    stripe_customer_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    stripe_subscription_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    price_key: Mapped[str] = mapped_column(String(16), nullable=False)  # month | year | year_founders
    status: Mapped[str] = mapped_column(String(24), nullable=False)  # active | past_due | canceled | ...
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    latest_invoice_id: Mapped[str | None] = mapped_column(String(64))
    latest_payment_intent_id: Mapped[str | None] = mapped_column(String(64))
    amount_cents: Mapped[int | None] = mapped_column(Integer)
    currency: Mapped[str | None] = mapped_column(String(3))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class StripeEvent(Base):
    """Idempotenza dei webhook: un evento processato non si riprocessa."""

    __tablename__ = "stripe_events"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Withdrawal(Base):
    __tablename__ = "withdrawals"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    subscription_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    refund_id: Mapped[str | None] = mapped_column(String(64))
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)


# ---------------------------------------------------------------- prodotto


class ProductEvent(Base):
    __tablename__ = "events"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    name: Mapped[str] = mapped_column(String(48), index=True, nullable=False)
    props: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    source: Mapped[str] = mapped_column(String(8), nullable=False, default="server")  # server | client
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class EmailLog(Base):
    __tablename__ = "email_log"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    to_email: Mapped[str] = mapped_column(String(320), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_id: Mapped[str | None] = mapped_column(String(128))
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DataExport(Base):
    __tablename__ = "data_exports"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
