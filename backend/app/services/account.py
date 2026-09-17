"""Scarica i tuoi dati (JSON) e cancella l'account. GDPR: portabilità e cancellazione."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.errors import NotFound
from app.models import (
    ChatMessage,
    DataExport,
    Entitlement,
    LlmUsage,
    Mesocycle,
    PlanChangeProposal,
    PlannedExercise,
    PlannedSession,
    PlanWeek,
    ProductEvent,
    Profile,
    ReadinessCheck,
    Subscription,
    User,
    Withdrawal,
)
from app.security import hash_token, new_opaque_token

EXPORT_TTL = timedelta(hours=24)


def _j(v):
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, datetime):
        return v.isoformat()
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return v


def _row(obj, fields: list[str]) -> dict:
    return {f: _j(getattr(obj, f)) for f in fields}


async def build_export(db: AsyncSession, user: User) -> dict:
    profile = await db.get(Profile, user.id)
    ent = await db.get(Entitlement, user.id)
    mesos = (
        await db.execute(
            select(Mesocycle)
            .where(Mesocycle.user_id == user.id)
            .options(selectinload(Mesocycle.weeks).selectinload(PlanWeek.sessions).selectinload(PlannedSession.exercises).selectinload(PlannedExercise.set_rows), selectinload(Mesocycle.weeks).selectinload(PlanWeek.sessions).selectinload(PlannedSession.readiness))
            .order_by(Mesocycle.index)
        )
    ).scalars().all()
    msgs = (await db.execute(select(ChatMessage).where(ChatMessage.user_id == user.id).order_by(ChatMessage.created_at))).scalars().all()
    props = (await db.execute(select(PlanChangeProposal).where(PlanChangeProposal.user_id == user.id))).scalars().all()
    usage = (await db.execute(select(LlmUsage).where(LlmUsage.user_id == user.id))).scalars().all()
    subs = (await db.execute(select(Subscription).where(Subscription.user_id == user.id))).scalars().all()
    wds = (await db.execute(select(Withdrawal).where(Withdrawal.user_id == user.id))).scalars().all()
    evs = (await db.execute(select(ProductEvent).where(ProductEvent.user_id == user.id).order_by(ProductEvent.created_at))).scalars().all()
    return {
        "exported_at": datetime.now(UTC).isoformat(),
        "user": {"id": str(user.id), "email": user.email, "email_verified": user.email_verified, "created_at": _j(user.created_at), "terms_accepted_at": _j(user.terms_accepted_at)},
        "profile": _row(profile, ["goal", "level", "days_per_week", "minutes_per_session", "location", "equipment", "health_consent_given", "health_consent_at", "constraints_text", "avoid_patterns", "safety_answers", "safety_flagged", "conservative", "onboarding_completed_at"]) if profile else None,
        "entitlement": _row(ent, ["plan", "source", "valid_until", "grace_until"]) if ent else None,
        "mesocycles": [
            {
                **_row(m, ["index", "status", "split", "tier", "total_weeks", "started_on", "engine_version", "rules_snapshot", "completed_at"]),
                "sessions": [
                    {
                        **_row(s, ["id", "week_n", "name", "date", "status", "est_minutes", "short_version", "closed_at", "close_line"]),
                        "readiness": _row(s.readiness, ["sleep", "mood", "pain", "short_version", "override", "created_at"]) if s.readiness else None,
                        "exercises": [
                            {**_row(e, ["exercise_id", "order", "sets", "reps_min", "reps_max", "rest_s", "rir_target", "rule_refs", "removed_today", "skipped", "substituted_from_id"]), "sets_log": [_row(r, ["n", "target_weight_kg", "target_reps", "target_rir", "logged_weight_kg", "logged_reps", "logged_rir", "status", "done_at"]) for r in sorted(e.set_rows, key=lambda r: r.n)]}
                            for e in sorted(s.exercises, key=lambda e: e.order)
                        ],
                    }
                    for w in m.weeks
                    for s in w.sessions
                ],
            }
            for m in mesos
        ],
        "chat_messages": [_row(x, ["id", "role", "kind", "status", "text", "blocks", "notes", "protocol", "created_at"]) for x in msgs],
        "plan_change_proposals": [_row(x, ["id", "origin", "patch", "diff", "status", "invalid_reason_it", "created_at", "resolved_at"]) for x in props],
        "llm_usage": [_row(x, ["provider", "model", "turn_kind", "tokens_in", "tokens_out", "tokens_cache_read", "tokens_cache_write", "cost_usd", "success", "created_at"]) for x in usage],
        "subscriptions": [_row(x, ["price_key", "status", "started_at", "current_period_end", "cancel_at_period_end", "amount_cents", "currency", "ended_at"]) for x in subs],
        "withdrawals": [_row(x, ["requested_at", "amount_cents", "currency"]) for x in wds],
        "events": [_row(x, ["name", "props", "source", "created_at"]) for x in evs],
    }


async def create_export(db: AsyncSession, user: User) -> tuple[str, datetime]:
    payload = await build_export(db, user)
    token = new_opaque_token()
    row = DataExport(user_id=user.id, token_hash=hash_token(token), payload=payload, expires_at=datetime.now(UTC) + EXPORT_TTL)
    db.add(row)
    await db.commit()
    return token, row.expires_at


async def read_export(db: AsyncSession, user: User, token: str) -> dict:
    row = (await db.execute(select(DataExport).where(DataExport.token_hash == hash_token(token), DataExport.user_id == user.id))).scalar_one_or_none()
    if row is None or row.expires_at < datetime.now(UTC):
        raise NotFound("Questo file non c'è più. Chiedine uno nuovo.")
    return row.payload


async def delete_account(db: AsyncSession, user: User) -> None:
    """Cancellazione vera: le FK sono ON DELETE CASCADE; gli eventi restano anonimi (SET NULL)."""
    await db.delete(user)
    await db.commit()
