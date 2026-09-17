"""State card: quello che il coach 'vede' a ogni turno. Compatta (~300-600 token), in italiano, senza dati inutili."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.clock import today_local
from app.models import Entitlement, Mesocycle, PlannedExercise, PlannedSession, Profile, User
from app.services import entitlements as ent_service
from app.services import plans as plans_service
from app.services.quota import ChatQuota

GOALS = {"hypertrophy": "ipertrofia", "strength": "forza", "health": "salute"}
TIERS = {"beginner": "principiante", "intermediate": "intermedio", "health": "salute (conservativo)"}
STATUS = {"planned": "in programma", "done": "fatta", "short": "corta", "skipped": "saltata"}


async def build_state_card(db: AsyncSession, user: User, quota: ChatQuota, today: date | None = None) -> str:
    today = today or today_local()
    profile = await db.get(Profile, user.id)
    ent = await db.get(Entitlement, user.id)
    meso = await plans_service.current_mesocycle(db, user.id)
    lines: list[str] = []
    if profile:
        lines.append(f"Profilo: obiettivo {GOALS.get(profile.goal, profile.goal)}, livello {TIERS.get('health' if profile.goal == 'health' else profile.level)}, {profile.days_per_week} giorni/sett, {profile.minutes_per_session} min, {profile.location}.")
        if profile.health_consent_given and profile.constraints_text:
            lines.append(f"Vincoli dichiarati (con consenso): {profile.constraints_text[:160]}. Schemi evitati: {', '.join(profile.avoid_patterns) or 'nessuno'}.")
        if profile.conservative:
            lines.append("Piano conservativo (gate di sicurezza o profilo salute).")
    pro = ent_service.is_pro(ent)
    active = ent_service.engine_active(ent, meso)
    lines.append(f"Entitlement: {'pro' if pro else 'free'}. engine_active: {'sì' if active else 'no'}. chat_turns_left: {quota.left}.")
    if meso is None:
        lines.append("Nessun piano ancora: l'utente non ha completato l'onboarding.")
        return "\n".join(lines)
    week_n = plans_service.week_n_for(meso, today)
    lines.append(f"Mesociclo {meso.index} ({meso.split}), settimana {min(week_n, meso.total_weeks)} di {meso.total_weeks}, stato {meso.status}. Inizio {meso.started_on.isoformat()}.")
    q = (
        select(PlannedSession)
        .where(PlannedSession.mesocycle_id == meso.id)
        .options(selectinload(PlannedSession.exercises).selectinload(PlannedExercise.set_rows), selectinload(PlannedSession.exercises).selectinload(PlannedExercise.exercise), selectinload(PlannedSession.readiness))
        .order_by(PlannedSession.date)
    )
    sessions = (await db.execute(q)).scalars().all()
    this_week = [s for s in sessions if s.week_n == week_n]
    if this_week:
        lines.append("Settimana corrente: " + "; ".join(f"{s.name} {s.date.strftime('%d/%m')} {STATUS.get(s.status, s.status)}{' (oggi)' if s.date == today else ''}" for s in this_week) + ".")
    closed = [s for s in sessions if s.closed_at is not None and s.status != "skipped"]
    for s in closed[-3:]:
        parts = []
        for e in s.exercises:
            done = [r for r in e.set_rows if r.status == "done"]
            if not done:
                continue
            best = max(done, key=lambda r: (float(r.logged_weight_kg or 0), r.logged_reps or 0))
            rirs = [r.logged_rir for r in done if r.logged_rir is not None]
            rir = f" RIR {sum(rirs) / len(rirs):.0f}" if rirs else ""
            w = f"{float(best.logged_weight_kg):g}kg" if best.logged_weight_kg is not None else "corpo libero"
            parts.append(f"{e.exercise.name_it} {len(done)}x{best.logged_reps or 0}@{w}{rir}")
        lines.append(f"Seduta {s.date.strftime('%d/%m')} {s.name} ({STATUS.get(s.status)}): " + ", ".join(parts[:6]) + ".")
    todays = next((s for s in sessions if s.date == today), None)
    if todays and todays.readiness:
        r = todays.readiness
        lines.append(f"Readiness oggi: sonno {r.sleep}, voglia {r.mood}, dolore {r.pain}{' -> versione corta' if r.short_version else ''}.")
    window = today - timedelta(days=28)
    recent = [s for s in sessions if window <= s.date <= today]
    done_n = sum(1 for s in recent if s.status in ("done", "short"))
    planned_n = sum(1 for s in recent if s.status in ("done", "short", "skipped"))
    lines.append(f"Aderenza 4 settimane: {done_n} su {planned_n} sedute.")
    skipped_recent = [s for s in sessions if s.status == "skipped" and (today - s.date).days <= 7]
    if skipped_recent:
        lines.append(f"Sedute saltate negli ultimi 7 giorni: {len(skipped_recent)}.")
    if meso.status == "maintenance":
        lines.append("In mantenimento: nessuna progressione, deload, proposta o rinegoziazione finché non parte il blocco 2 (Pro).")
    return "\n".join(lines)
