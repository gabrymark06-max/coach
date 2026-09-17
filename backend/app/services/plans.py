"""Piano: dal MesoPlan puro alle tabelle, e viceversa. Stato del mesociclo, mantenimento, blocco 2, riepilogo."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.engine import (
    MesoPlan,
    ProfileInput,
    WeekSpec,
    catalog_from_rows,
    generate_mesocycle,
    maintenance_week,
    rules_from_rows,
)
from app.engine.models import ExerciseSpec, Rule as EngineRule
from app.errors import NotFound, PlanRequired
from app.models import (
    Entitlement,
    Exercise,
    Mesocycle,
    PlannedExercise,
    PlannedSession,
    PlanWeek,
    Profile,
    Rule,
    SessionSet,
    User,
)
from app.schemas.plans import (
    HighlightOut,
    PlanMesocycleOut,
    PlanOut,
    SummaryOut,
    WeekChangeOut,
    WeekOut,
    WeekSessionOut,
)
from app.services import entitlements as ent_service
from app.services import events
from app.services.notes import KnowledgeIndex, NoteBook

DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

_FULL_LOAD = (
    selectinload(Mesocycle.weeks).selectinload(PlanWeek.sessions).selectinload(PlannedSession.exercises).selectinload(PlannedExercise.set_rows),
    selectinload(Mesocycle.weeks).selectinload(PlanWeek.sessions).selectinload(PlannedSession.exercises).selectinload(PlannedExercise.exercise),
    selectinload(Mesocycle.weeks).selectinload(PlanWeek.sessions).selectinload(PlannedSession.readiness),
)


# ---------------------------------------------------------------- input del motore


async def engine_inputs(db: AsyncSession) -> tuple[dict[str, EngineRule], list[ExerciseSpec]]:
    rules = rules_from_rows((await db.execute(select(Rule))).scalars().all())
    catalog = catalog_from_rows((await db.execute(select(Exercise))).scalars().all())
    if not rules or not catalog:
        raise RuntimeError("base di conoscenza vuota: esegui `python -m scripts.seed`")
    return rules, catalog


def profile_input(p: Profile) -> ProfileInput:
    return ProfileInput(
        goal=p.goal,
        level=p.level,
        days_per_week=p.days_per_week,
        minutes_per_session=p.minutes_per_session,
        location=p.location,
        equipment=list(p.equipment or []),
        avoid_patterns=list(p.avoid_patterns or []) if p.health_consent_given else [],
        conservative=p.conservative,
    )


# ---------------------------------------------------------------- persistenza


def _persist_week(db: AsyncSession, meso: Mesocycle, user_id, w: WeekSpec) -> PlanWeek:
    week = PlanWeek(
        mesocycle_id=meso.id,
        n=w.n,
        is_deload=w.is_deload,
        is_maintenance=w.is_maintenance,
        label_it=w.label_it,
        starts_on=w.starts_on,
        changes=w.changes,
    )
    for s in w.sessions:
        ps = PlannedSession(
            id=uuid.uuid4(),
            user_id=user_id,
            mesocycle_id=meso.id,
            week_n=w.n,
            index_in_week=s.index_in_week,
            sessions_in_week=s.sessions_in_week,
            name=s.name,
            template_key=s.template_key,
            date=s.date,
            status="planned",
            est_minutes=s.est_minutes,
            short_version=s.short_version,
            updated_at=datetime.now(UTC),
        )
        for e in s.exercises:
            pe = PlannedExercise(
                exercise_id=e.exercise_id,
                order=e.order,
                slot_pattern=e.pattern,
                sets=e.sets,
                reps_min=e.reps[0],
                reps_max=e.reps[1],
                rest_s=e.rest_s,
                rir_target=e.rir_target,
                rule_refs=dict(e.rule_refs),
                removed_today=e.removed_today,
                removed_reason_it=e.removed_reason_it,
                removed_rule_id=e.removed_rule_id,
                changed_today_label_it=e.changed_today_label_it,
            )
            for t in e.set_targets:
                pe.set_rows.append(
                    SessionSet(session_id=ps.id, n=t.n, target_weight_kg=t.target_weight_kg, target_reps=t.target_reps, target_rir=t.target_rir)
                )
            ps.exercises.append(pe)
        week.sessions.append(ps)
    db.add(week)
    return week


async def persist_plan(db: AsyncSession, user: User, plan: MesoPlan, rules: dict[str, EngineRule]) -> Mesocycle:
    meso = Mesocycle(
        user_id=user.id,
        index=plan.index,
        status="active",
        split=plan.split,
        tier=plan.tier,
        total_weeks=plan.total_weeks,
        started_on=plan.started_on,
        engine_version=plan.engine_version,
        rules_snapshot={rid: rules[rid].version for rid in sorted(plan.rule_ids) if rid in rules},
    )
    db.add(meso)
    await db.flush()
    for w in plan.weeks:
        _persist_week(db, meso, user.id, w)
    await db.flush()
    db.expire(meso, ["weeks"])
    meso = (await db.execute(select(Mesocycle).where(Mesocycle.id == meso.id).options(*_FULL_LOAD))).scalar_one()
    return meso


# ---------------------------------------------------------------- lettura


async def current_mesocycle(db: AsyncSession, user_id, *, load_all: bool = False) -> Mesocycle | None:
    q = select(Mesocycle).where(Mesocycle.user_id == user_id).order_by(Mesocycle.index.desc()).limit(1)
    if load_all:
        q = q.options(*_FULL_LOAD)
    return (await db.execute(q)).scalar_one_or_none()


async def require_mesocycle(db: AsyncSession, user_id, *, load_all: bool = False) -> Mesocycle:
    meso = await current_mesocycle(db, user_id, load_all=load_all)
    if meso is None:
        raise NotFound("Il piano non c'è ancora.", code="no_plan")
    return meso


def block_end(meso: Mesocycle) -> date:
    return meso.started_on + timedelta(days=7 * meso.total_weeks - 1)


def week_n_for(meso: Mesocycle, today: date) -> int:
    days = (today - meso.started_on).days
    return max(1, days // 7 + 1)


async def refresh_status(db: AsyncSession, meso: Mesocycle, user: User, today: date) -> Mesocycle:
    """Chiusura del blocco a fine calendario; sedute passate non fatte -> skipped."""
    changed = False
    if meso.status == "active" and today > block_end(meso):
        meso.status = "completed"
        meso.completed_at = datetime.now(UTC)
        await events.record(db, user.id, "mesocycle_completed", {"index": meso.index})
        changed = True
    rows = (
        await db.execute(
            select(PlannedSession).where(
                PlannedSession.mesocycle_id == meso.id, PlannedSession.status == "planned", PlannedSession.date < today
            )
        )
    ).scalars().all()
    for s in rows:
        s.status = "skipped"
        changed = True
    if changed:
        await db.flush()
    return meso


async def ensure_maintenance_weeks(db: AsyncSession, meso: Mesocycle, user: User, today: date, rules, catalog) -> None:
    """In mantenimento, crea settimane che si ripetono finché una copre oggi (lazy)."""
    if meso.status != "maintenance":
        return
    last_n = max(w.n for w in meso.weeks)
    if today <= meso.started_on + timedelta(days=7 * last_n - 1):
        return
    plan = await plan_from_db(db, meso, user, rules, catalog)
    n = last_n
    while today > meso.started_on + timedelta(days=7 * n - 1):
        n += 1
        _persist_week(db, meso, user.id, maintenance_week(plan, n=n))
    await db.flush()
    db.expire(meso, ["weeks"])
    await db.execute(select(Mesocycle).where(Mesocycle.id == meso.id).options(*_FULL_LOAD))


async def plan_from_db(db: AsyncSession, meso: Mesocycle, user: User, rules, catalog) -> MesoPlan:
    """Rigenera il MesoPlan puro dal profilo per le operazioni del motore (mantenimento)."""
    profile = await db.get(Profile, user.id)
    plan = generate_mesocycle(profile_input(profile), rules, catalog, start=meso.started_on, index=meso.index)
    # riallinea i carichi dell'ultima settimana di allenamento con quelli effettivamente nel DB
    by_key = {(w.n, s.template_key): s for w in meso.weeks for s in w.sessions}
    for w in plan.weeks:
        for s in w.sessions:
            dbs = by_key.get((w.n, s.template_key))
            if not dbs:
                continue
            db_ex = {e.exercise_id: e for e in dbs.exercises}
            for e in s.exercises:
                de = db_ex.get(e.exercise_id)
                if de is None:
                    continue
                e.sets = de.sets
                e.rir_target = de.rir_target
                e.rest_s = de.rest_s
                e.rebuild_sets()
                for t, row in zip(e.set_targets, sorted(de.set_rows, key=lambda r: r.n), strict=False):
                    t.target_weight_kg = float(row.target_weight_kg) if row.target_weight_kg is not None else None
                    t.target_reps = row.target_reps
    return plan


async def build_plan_out(db: AsyncSession, meso: Mesocycle, user: User, ent: Entitlement, today: date) -> PlanOut:
    index = await KnowledgeIndex.load(db)
    nb = NoteBook(index)
    editable = ent_service.engine_active(ent, meso)
    cur_n = week_n_for(meso, today)
    weeks: list[WeekOut] = []
    for w in sorted(meso.weeks, key=lambda x: x.n):
        changes = [WeekChangeOut(text=nb.mark(c["text"]), note_n=nb.n(c.get("rule_id"))) for c in (w.changes or [])]
        sessions = []
        for s in sorted(w.sessions, key=lambda x: x.index_in_week):
            status = s.status
            if status == "planned":
                status = "today" if s.date == today else "planned"
            sessions.append(
                WeekSessionOut(
                    session_id=s.id,
                    day=DAY_KEYS[s.date.weekday()],
                    date=s.date,
                    name=s.name,
                    exercises_count=len([e for e in s.exercises if not e.removed_today]),
                    sets_count=sum(e.sets for e in s.exercises if not e.removed_today),
                    est_minutes=s.est_minutes,
                    status=status,
                )
            )
        weeks.append(
            WeekOut(
                n=w.n,
                label_it=w.label_it,
                is_current=(w.n == cur_n) if meso.status != "completed" else False,
                is_deload=w.is_deload,
                is_maintenance=w.is_maintenance,
                changes_it=changes,
                sessions=sessions,
            )
        )
    for rid in ("block.length_weeks", f"volume.weekly_sets.{meso.tier}", "progression.double.reps_then_load"):
        nb.n(rid)
    if meso.status == "maintenance":
        nb.n("maintenance.repeat_week")
    return PlanOut(
        mesocycle=PlanMesocycleOut(
            index=meso.index,
            status=meso.status,
            total_weeks=meso.total_weeks,
            editable=editable and meso.status == "active",
            split=meso.split,
            started_on=meso.started_on,
            maintenance_note_it=(
                "In mantenimento la settimana si ripete uguale. Per modificarla serve il blocco 2 — Pro."
                if meso.status == "maintenance"
                else None
            ),
        ),
        weeks=weeks,
        notes=nb.notes(),
    )


# ---------------------------------------------------------------- transizioni


async def start_maintenance(db: AsyncSession, meso: Mesocycle, user: User, today: date, rules, catalog) -> Mesocycle:
    if meso.status == "active":
        raise PlanRequired("Il blocco non è ancora finito.", code="block_not_completed", status_code=409)
    meso.status = "maintenance"
    await db.flush()
    await ensure_maintenance_weeks(db, meso, user, today, rules, catalog)
    return meso


async def create_next_mesocycle(db: AsyncSession, user: User, ent: Entitlement, today: date, rules, catalog) -> Mesocycle:
    prev = await current_mesocycle(db, user.id, load_all=True)
    if prev is None:
        raise NotFound("Il piano non c'è ancora.", code="no_plan")
    if not ent_service.is_pro(ent):
        raise PlanRequired()
    if prev.status == "active" and today <= block_end(prev):
        raise PlanRequired("Il blocco in corso non è ancora finito.", code="block_not_completed", status_code=409)
    profile = await db.get(Profile, user.id)
    plan = generate_mesocycle(profile_input(profile), rules, catalog, start=today, index=prev.index + 1)
    # continuità dei carichi: parte dall'ultimo target noto per esercizio
    last_weights = await last_targets_by_exercise(db, user.id)
    for w in plan.weeks:
        for s in w.sessions:
            for e in s.exercises:
                lw = last_weights.get(e.exercise_id)
                if lw is not None:
                    e.rule_refs["weight"] = "progression.double.reps_then_load"
                    for t in e.set_targets:
                        t.target_weight_kg = lw
    if prev.status != "completed":
        prev.status = "completed"
        prev.completed_at = datetime.now(UTC)
    meso = await persist_plan(db, user, plan, rules)
    return meso


async def last_targets_by_exercise(db: AsyncSession, user_id) -> dict[str, float]:
    q = (
        select(PlannedExercise.exercise_id, SessionSet.logged_weight_kg, PlannedSession.closed_at)
        .join(SessionSet, SessionSet.planned_exercise_id == PlannedExercise.id)
        .join(PlannedSession, PlannedSession.id == PlannedExercise.session_id)
        .where(PlannedSession.user_id == user_id, SessionSet.status == "done", SessionSet.logged_weight_kg.is_not(None))
        .order_by(PlannedSession.closed_at.desc())
    )
    out: dict[str, float] = {}
    for ex_id, w, _ in (await db.execute(q)).all():
        out.setdefault(ex_id, float(w))
    return out


# ---------------------------------------------------------------- riepilogo di fine blocco


async def build_summary(db: AsyncSession, settings: Settings, meso: Mesocycle, user: User, ent: Entitlement, llm) -> SummaryOut:
    from app.services.coach import generate_protocol_text

    if meso.status == "active":
        raise PlanRequired("Il blocco non è ancora finito.", code="block_not_completed", status_code=409)
    sessions = [s for w in meso.weeks for s in w.sessions if not w.is_maintenance]
    done = [s for s in sessions if s.status in ("done", "short")]
    highlights: list[HighlightOut] = [
        HighlightOut(label_it="Sedute", **{"from": len(done), "to": len(sessions)}, unit=None, kind="count")
    ]
    # i due esercizi con il progresso di carico maggiore
    progress: dict[str, tuple[float, float, str]] = {}
    for s in sorted(done, key=lambda x: x.date):
        for e in s.exercises:
            ws = [float(r.logged_weight_kg) for r in e.set_rows if r.status == "done" and r.logged_weight_kg is not None]
            if not ws:
                continue
            best = max(ws)
            first, _, name = progress.get(e.exercise_id, (best, best, e.exercise.name_it))
            progress[e.exercise_id] = (first, best, name)
    gains = sorted(((v[1] - v[0], k, v) for k, v in progress.items()), reverse=True)
    for gain, _, (first, last, name) in gains[:2]:
        if gain > 0:
            highlights.append(HighlightOut(label_it=f"{name}, kg", **{"from": first, "to": last}, unit="kg", kind="weight"))
    index = await KnowledgeIndex.load(db)
    nb = NoteBook(index)
    for rid in ("progression.double.reps_then_load", "deload.volume_and_load", f"volume.weekly_sets.{meso.tier}"):
        nb.n(rid)
    context = (
        f"Sedute fatte {len(done)} su {len(sessions)}. "
        + "; ".join(f"{h.label_it}: {h.from_value} -> {h.to_value}" for h in highlights[1:])
    )
    text, resp = await generate_protocol_text(llm, "block_summary", context, tier="base")
    pro = ent_service.is_pro(ent)
    preview = "più volume sui gruppi che sono cresciuti meno, carichi ripartono dagli ultimi loggati, deload in settimana 4"
    return SummaryOut(
        block_index=meso.index,
        sessions_done=len(done),
        sessions_planned=len(sessions),
        highlights=highlights[:3],
        coach_paragraph=text,
        notes=nb.notes(),
        next_block_preview_it=preview,
        is_pro=pro,
        paywall_context_line=f"Il blocco {meso.index + 1} sui tuoi numeri: {preview}.",
    )


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()


async def count_closed_sessions(db: AsyncSession, user_id) -> int:
    q = select(func.count(PlannedSession.id)).where(PlannedSession.user_id == user_id, PlannedSession.closed_at.is_not(None))
    return int((await db.execute(q)).scalar_one())
