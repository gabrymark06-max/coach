"""La seduta: lettura con note inline, readiness, scritture idempotenti (client_op_id), chiusura, sync."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.engine import (
    LoggedSet,
    Prescription,
    ProfileInput,
    ReadinessInput,
    SessionSpec,
    adapt_for_readiness,
    candidates,
    deload_weight,
    estimate_minutes,
    next_targets,
    shorten,
)
from app.engine.models import ReadinessResult
from app.engine.models import PlannedExerciseSpec, SetTarget
from app.errors import ApiError, Conflict, NotFound, UnprocessableError
from app.models import (
    ChatMessage,
    Exercise,
    Mesocycle,
    PlannedExercise,
    PlannedSession,
    PlanWeek,
    Profile,
    ReadinessCheck,
    SessionSet,
    SetOp,
    User,
)
from app.schemas.plans import (
    ChangedSetOut,
    ChangedTodayOut,
    CloseIn,
    MediaOut,
    NameOut,
    PrescriptionOut,
    ReadinessDiffOut,
    ReadinessOut,
    RemovedExerciseOut,
    SafetyOptionOut,
    SafetyOut,
    SessionExerciseOut,
    SessionOut,
    SetLoggedOut,
    SetOut,
    SetPatchIn,
    SetPreviousOut,
    SetTargetOut,
    SubstituteOut,
    SyncOpIn,
    SyncResultOut,
)
from app.schemas.common import IntWithNote, RangeWithNote
from app.services import events
from app.services.notes import KnowledgeIndex, NoteBook
from app.services.plans import engine_inputs, profile_input

_LOAD = (
    selectinload(PlannedSession.exercises).selectinload(PlannedExercise.set_rows),
    selectinload(PlannedSession.exercises).selectinload(PlannedExercise.exercise),
    selectinload(PlannedSession.exercises).selectinload(PlannedExercise.substituted_from),
    selectinload(PlannedSession.readiness),
    selectinload(PlannedSession.week),
)


def _f(x) -> float | None:
    return float(x) if x is not None else None


async def load_session(db: AsyncSession, user_id, session_id: uuid.UUID, *, for_update: bool = False) -> PlannedSession:
    """`for_update=True` per ogni scrittura: `SELECT ... FOR UPDATE` sulla riga della seduta serializza le richieste
    concorrenti sulla stessa seduta (QA2 N2). La seconda aspetta il commit della prima e poi vede la `SetOp` già
    registrata: risponde `duplicate` invece di urtare `uq_session_op` con un 500. Le letture non bloccano."""
    q = select(PlannedSession).where(PlannedSession.id == session_id, PlannedSession.user_id == user_id).options(*_LOAD)
    if for_update:
        q = q.with_for_update(of=PlannedSession)
    s = (await db.execute(q)).scalar_one_or_none()
    if s is None:
        raise NotFound()
    return s


# ---------------------------------------------------------------- DB <-> spec del motore


def to_spec(s: PlannedSession) -> SessionSpec:
    exercises = []
    for e in sorted(s.exercises, key=lambda x: x.order):
        pe = PlannedExerciseSpec(
            exercise_id=e.exercise_id,
            name_it=e.exercise.name_it,
            pattern=e.slot_pattern,
            primary_muscle=e.exercise.primary_muscle,
            equipment=e.exercise.equipment,
            mechanic=e.exercise.mechanic,
            spinal_load=e.exercise.spinal_load,
            order=e.order,
            sets=e.sets,
            reps=(e.reps_min, e.reps_max),
            rest_s=e.rest_s,
            rir_target=e.rir_target,
            rule_refs=dict(e.rule_refs or {}),
            set_targets=[
                SetTarget(n=r.n, target_weight_kg=_f(r.target_weight_kg), target_reps=r.target_reps, target_rir=r.target_rir)
                for r in sorted(e.set_rows, key=lambda r: r.n)
            ],
            removed_today=e.removed_today,
            removed_reason_it=e.removed_reason_it,
            removed_rule_id=e.removed_rule_id,
            changed_today_label_it=e.changed_today_label_it,
            substituted_from_id=e.substituted_from_id,
        )
        exercises.append(pe)
    return SessionSpec(
        template_key=s.template_key,
        name=s.name,
        index_in_week=s.index_in_week,
        sessions_in_week=s.sessions_in_week,
        date=s.date,
        exercises=exercises,
        est_minutes=s.est_minutes,
        short_version=s.short_version,
    )


def apply_spec(s: PlannedSession, spec: SessionSpec) -> None:
    """Scrive nel DB le modifiche del motore preservando i log già presenti sulle serie."""
    by_id = {e.exercise_id: e for e in s.exercises}
    for pe in spec.exercises:
        e = by_id[pe.exercise_id]
        if e.original is None and (pe.sets != e.sets or pe.rest_s != e.rest_s or pe.rir_target != e.rir_target or pe.removed_today):
            e.original = {"sets": e.sets, "rest_s": e.rest_s, "rir_target": e.rir_target, "rule_refs": dict(e.rule_refs or {})}
        e.sets = pe.sets
        e.rest_s = pe.rest_s
        e.rir_target = pe.rir_target
        e.rule_refs = dict(pe.rule_refs)
        e.removed_today = pe.removed_today
        e.removed_reason_it = pe.removed_reason_it
        e.removed_rule_id = pe.removed_rule_id
        e.changed_today_label_it = pe.changed_today_label_it
        rows = sorted(e.set_rows, key=lambda r: r.n)
        for t in pe.set_targets:
            row = next((r for r in rows if r.n == t.n), None)
            if row is None:
                e.set_rows.append(
                    SessionSet(session_id=s.id, n=t.n, target_weight_kg=t.target_weight_kg, target_reps=t.target_reps, target_rir=t.target_rir)
                )
            else:
                row.target_rir = t.target_rir
        for row in rows:
            if row.n > pe.sets and row.status == "todo":
                e.set_rows.remove(row)
    s.short_version = spec.short_version
    s.est_minutes = spec.est_minutes


# ---------------------------------------------------------------- output


async def previous_by_exercise(db: AsyncSession, user_id, session: PlannedSession) -> dict[tuple[str, int], SetPreviousOut]:
    ex_ids = [e.exercise_id for e in session.exercises]
    if not ex_ids:
        return {}
    q = (
        select(PlannedExercise.exercise_id, SessionSet.n, SessionSet.logged_weight_kg, SessionSet.logged_reps, SessionSet.logged_rir, PlannedSession.date, PlannedSession.closed_at)
        .join(SessionSet, SessionSet.planned_exercise_id == PlannedExercise.id)
        .join(PlannedSession, PlannedSession.id == PlannedExercise.session_id)
        .where(
            PlannedSession.user_id == user_id,
            PlannedSession.id != session.id,
            PlannedSession.closed_at.is_not(None),
            PlannedSession.date <= session.date,
            PlannedExercise.exercise_id.in_(ex_ids),
            SessionSet.status == "done",
        )
        .order_by(PlannedSession.closed_at.desc())
    )
    out: dict[tuple[str, int], SetPreviousOut] = {}
    for ex_id, n, w, reps, rir, d, _ in (await db.execute(q)).all():
        out.setdefault((ex_id, n), SetPreviousOut(weight_kg=_f(w), reps=reps, rir=rir, date=d))
    return out


def _why(cand, base) -> str:
    if cand.equipment != base.equipment:
        names = {"barbell": "bilanciere", "dumbbell": "manubri", "machine": "macchina", "cable": "cavo", "bodyweight": "corpo libero", "band": "elastico"}
        return f"Stesso schema, con {names.get(cand.equipment, cand.equipment)}"
    return "Stesso schema di movimento"


async def build_session_out(db: AsyncSession, user: User, s: PlannedSession, *, nb: NoteBook | None = None) -> SessionOut:
    index = nb.index if nb else await KnowledgeIndex.load(db)
    nb = nb or NoteBook(index)
    profile = await db.get(Profile, user.id)
    _, catalog = await engine_inputs(db)
    pin = profile_input(profile)
    cat_by_id = {c.id: c for c in catalog}
    prev = await previous_by_exercise(db, user.id, s)
    exercises: list[SessionExerciseOut] = []
    for e in sorted(s.exercises, key=lambda x: x.order):
        refs = e.rule_refs or {}
        local_rules = [refs.get(k) for k in ("sets", "reps", "rest", "rir", "selection", "weight")]
        if e.removed_rule_id:
            local_rules.append(e.removed_rule_id)
        ns = [nb.n(r) for r in local_rules if r]
        spec = cat_by_id.get(e.exercise_id)
        subs = [SubstituteOut(exercise_id=c.id, name_it=c.name_it, why_it=_why(c, spec)) for c in candidates(catalog, e.slot_pattern, pin, exclude={e.exercise_id})[:5]] if spec else []
        sets = [
            SetOut(
                id=r.id,
                n=r.n,
                target=SetTargetOut(weight_kg=_f(r.target_weight_kg), reps=r.target_reps, rir=r.target_rir),
                previous=prev.get((e.exercise_id, r.n)),
                logged=(
                    SetLoggedOut(weight_kg=_f(r.logged_weight_kg), reps=r.logged_reps, rir=r.logged_rir, status=r.status, done_at=r.done_at)
                    if (r.status != "todo" or r.logged_reps is not None or r.logged_weight_kg is not None)
                    else None
                ),
            )
            for r in sorted(e.set_rows, key=lambda r: r.n)
        ]
        exercises.append(
            SessionExerciseOut(
                id=e.id,
                exercise_id=e.exercise_id,
                name_it=e.exercise.name_it,
                pattern=e.slot_pattern,
                order=e.order,
                media=MediaOut(gif_url=e.exercise.gif_url, poster_url=e.exercise.poster_url, attribution=e.exercise.attribution),
                prescription=PrescriptionOut(
                    sets=IntWithNote(value=e.sets, note_n=nb.n(refs.get("sets"))),
                    reps=RangeWithNote(range=[e.reps_min, e.reps_max], note_n=nb.n(refs.get("reps"))),
                    rest_s=IntWithNote(value=e.rest_s, unit="s", note_n=nb.n(refs.get("rest"))),
                    rir_target=IntWithNote(value=e.rir_target, note_n=nb.n(refs.get("rir"))),
                ),
                substituted_from=NameOut(name_it=e.substituted_from.name_it) if e.substituted_from else None,
                changed_today=ChangedTodayOut(label_it=e.changed_today_label_it) if e.changed_today_label_it else None,
                removed_today=e.removed_today,
                removed_reason_it=e.removed_reason_it,
                skipped=e.skipped,
                substitutes=subs,
                instructions_it=list(e.exercise.instructions_it or []),
                sets=sets,
                notes=[n for n in nb.notes() if n.n in set(ns)],
            )
        )
    nb.n("session.duration_estimate")
    nb.n("order.compound_first")
    return SessionOut(
        id=s.id,
        name=s.name,
        date=s.date,
        week=s.week_n,
        index_in_week=s.index_in_week,
        sessions_in_week=s.sessions_in_week,
        status=s.status,
        short_version=s.short_version,
        est_minutes=s.est_minutes,
        updated_at=s.updated_at,
        readiness_done=s.readiness is not None,
        exercises=exercises,
        notes=nb.notes(),
        close_line=s.close_line,
    )


# ---------------------------------------------------------------- readiness


def _diff_out(result: ReadinessResult, nb: NoteBook) -> ReadinessDiffOut:
    return ReadinessDiffOut(
        removed_exercises=[RemovedExerciseOut(exercise_id=x.exercise_id, name=x.name_it, reason_it=x.reason_it, note_n=nb.n(x.rule_id)) for x in result.diff.removed_exercises],
        changed_sets=[ChangedSetOut(set_id=None, exercise_id=c.exercise_id, field=c.field, **{"from": c.from_value, "to": c.to_value}) for c in result.diff.changed_sets],
        short_version=result.diff.short_version,
        est_minutes=result.diff.est_minutes,
    )


SAFETY_READINESS_PROTOCOL = "safety.readiness"


def _safety_message(user: User, result: ReadinessResult) -> ChatMessage:
    """Il blocco di sicurezza della readiness è un messaggio del coach (`kind:safety`), la stessa forma del filtro in chat:
    così le opzioni (pause_plan, remove_exercise, continue_anyway) si eseguono con POST /chat/options/{id} { message_id }."""
    assert result.safety is not None
    return ChatMessage(
        user_id=user.id,
        role="coach",
        kind="safety",
        status="sent",
        text=result.safety.text,
        blocks=[{"type": "safety", "text": result.safety.text, "options": [{"id": o.id, "label": o.label, "is_pro": False, "chosen": False} for o in result.safety.options]}],
        notes=[],
        protocol=SAFETY_READINESS_PROTOCOL,
    )


async def apply_readiness(db: AsyncSession, user: User, s: PlannedSession, r: ReadinessInput) -> ReadinessOut:
    if s.readiness is not None:
        raise Conflict("La readiness di oggi è già registrata.", code="readiness_already_done")
    if s.closed_at is not None:
        raise Conflict("La seduta è già chiusa.", code="session_closed")
    rules, _ = await engine_inputs(db)
    result = adapt_for_readiness(to_spec(s), r, rules)
    apply_spec(s, result.session)
    index = await KnowledgeIndex.load(db)
    nb = NoteBook(index)
    coach_line = nb.mark(result.coach_line)
    diff = _diff_out(result, nb)
    check = ReadinessCheck(
        user_id=user.id,
        session_id=s.id,
        sleep=r.sleep,
        mood=r.mood,
        pain=r.pain,
        short_version=result.diff.short_version,
        diff=diff.model_dump(mode="json", by_alias=True),
    )
    db.add(check)
    s.readiness = check
    s.updated_at = datetime.now(UTC)
    await db.flush()
    session_out = await build_session_out(db, user, s, nb=nb)
    safety = None
    if result.safety is not None:
        msg = _safety_message(user, result)
        db.add(msg)
        await db.flush()
        await events.record(db, user.id, "safety_triggered", {"session_id": str(s.id), "source": "readiness", "message_id": str(msg.id)})
        safety = SafetyOut(text=result.safety.text, options=[SafetyOptionOut(id=o.id, label=o.label) for o in result.safety.options], message_id=msg.id)
    return ReadinessOut(session=session_out, diff=diff, coach_line=coach_line, notes=nb.notes(), safety=safety)


async def apply_short(db: AsyncSession, user: User, s: PlannedSession) -> ReadinessOut:
    """Versione corta scelta dall'anteprima di Oggi (design §3.3 passo 1): stesso motore, senza questionario. Non tocca la readiness."""
    if s.closed_at is not None:
        raise Conflict("La seduta è già chiusa.", code="session_closed")
    if s.short_version:
        raise Conflict("La seduta è già in versione corta.", code="already_short")
    rules, _ = await engine_inputs(db)
    result = shorten(to_spec(s), rules)
    apply_spec(s, result.session)
    index = await KnowledgeIndex.load(db)
    nb = NoteBook(index)
    coach_line = nb.mark(result.coach_line)
    diff = _diff_out(result, nb)
    s.updated_at = datetime.now(UTC)
    await db.flush()
    session_out = await build_session_out(db, user, s, nb=nb)
    return ReadinessOut(session=session_out, diff=diff, coach_line=coach_line, notes=nb.notes(), safety=None)


async def restore_removed(db: AsyncSession, user: User, s: PlannedSession, exercise_id: str) -> SessionOut:
    e = next((x for x in s.exercises if x.exercise_id == exercise_id), None)
    if e is None:
        raise NotFound("Questo esercizio non è nella seduta.")
    _require_open(s)
    if not e.removed_today:
        raise Conflict("Questo esercizio è già nella seduta.", code="not_removed")
    _restore_original(e)
    e.removed_today = False
    e.removed_reason_it = None
    e.removed_rule_id = None
    if s.readiness is not None:
        s.readiness.override = True
    s.updated_at = datetime.now(UTC)
    rules, _ = await engine_inputs(db)
    s.est_minutes = estimate_minutes(to_spec(s), rules)
    await db.flush()
    return await build_session_out(db, user, s)


def _restore_original(e: PlannedExercise) -> None:
    if e.original:
        e.sets = e.original["sets"]
        e.rest_s = e.original["rest_s"]
        e.rir_target = e.original["rir_target"]
        e.rule_refs = dict(e.original.get("rule_refs") or e.rule_refs)
        e.changed_today_label_it = None
        rows = sorted(e.set_rows, key=lambda r: r.n)
        last = rows[-1] if rows else None
        for n in range(len(rows) + 1, e.sets + 1):
            e.set_rows.append(
                SessionSet(
                    session_id=e.session_id,
                    n=n,
                    target_weight_kg=last.target_weight_kg if last else None,
                    target_reps=last.target_reps if last else e.reps_min,
                    target_rir=e.rir_target,
                )
            )
        for r in rows:
            r.target_rir = e.rir_target
        e.original = None


# ---------------------------------------------------------------- scritture idempotenti


def _require_open(s: PlannedSession) -> None:
    """Una seduta chiusa è un fatto: la progressione è già calcolata, non si riscrive (QA G1).
    Va chiamato *dopo* il controllo di idempotenza: rimandare un'op già applicata resta sempre sicuro."""
    if s.closed_at is not None:
        raise Conflict("La seduta è già chiusa.", code="session_closed")


async def _op_result(db: AsyncSession, s: PlannedSession, client_op_id: str) -> SetOp | None:
    q = select(SetOp).where(SetOp.session_id == s.id, SetOp.client_op_id == client_op_id)
    return (await db.execute(q)).scalar_one_or_none()


async def _record_op(db: AsyncSession, s: PlannedSession, client_op_id: str, op: str, result: dict) -> None:
    db.add(SetOp(session_id=s.id, client_op_id=client_op_id, op=op, result=result))
    await db.flush()


def _bump(s: PlannedSession, client_updated_at: datetime) -> None:
    if client_updated_at.tzinfo is None:
        client_updated_at = client_updated_at.replace(tzinfo=UTC)
    if client_updated_at > s.updated_at:
        s.updated_at = client_updated_at


def _set_out(e: PlannedExercise, r: SessionSet, prev: SetPreviousOut | None = None) -> SetOut:
    return SetOut(
        id=r.id,
        n=r.n,
        target=SetTargetOut(weight_kg=_f(r.target_weight_kg), reps=r.target_reps, rir=r.target_rir),
        previous=prev,
        logged=SetLoggedOut(weight_kg=_f(r.logged_weight_kg), reps=r.logged_reps, rir=r.logged_rir, status=r.status, done_at=r.done_at)
        if (r.status != "todo" or r.logged_reps is not None or r.logged_weight_kg is not None)
        else None,
    )


def _find_set(s: PlannedSession, set_id: uuid.UUID) -> tuple[PlannedExercise, SessionSet]:
    for e in s.exercises:
        for r in e.set_rows:
            if r.id == set_id:
                return e, r
    raise NotFound("Questa serie non è nella seduta.")


def _apply_set_fields(r: SessionSet, *, weight_kg, reps, rir, status, client_updated_at: datetime) -> bool:
    ts = client_updated_at if client_updated_at.tzinfo else client_updated_at.replace(tzinfo=UTC)
    if r.client_updated_at is not None and ts < r.client_updated_at:
        return False  # scrittura più vecchia di quella già applicata: last-write-wins per riga
    if weight_kg is not None:
        r.logged_weight_kg = Decimal(str(weight_kg))
    if reps is not None:
        r.logged_reps = reps
    if rir is not None:
        r.logged_rir = rir
    if status is not None:
        r.status = status
        r.done_at = ts if status == "done" else None
    r.client_updated_at = ts
    return True


async def patch_set(db: AsyncSession, user: User, s: PlannedSession, set_id: uuid.UUID, body: SetPatchIn) -> SetOut:
    e, r = _find_set(s, set_id)
    if (existing := await _op_result(db, s, body.client_op_id)) is not None:
        return _set_out(e, r)
    _require_open(s)
    _apply_set_fields(r, weight_kg=body.weight_kg, reps=body.reps, rir=body.rir, status=body.status, client_updated_at=body.client_updated_at)
    _bump(s, body.client_updated_at)
    await _record_op(db, s, body.client_op_id, "patch_set", {"set_id": str(set_id)})
    return _set_out(e, r)


async def add_set(db: AsyncSession, user: User, s: PlannedSession, planned_exercise_id: uuid.UUID, client_op_id: str, client_updated_at: datetime) -> SetOut:
    e = next((x for x in s.exercises if x.id == planned_exercise_id), None)
    if e is None:
        raise NotFound("Questo esercizio non è nella seduta.")
    if (existing := await _op_result(db, s, client_op_id)) is not None:
        r = next((x for x in e.set_rows if str(x.id) == existing.result.get("set_id")), None)
        if r is not None:
            return _set_out(e, r)
    _require_open(s)
    rows = sorted(e.set_rows, key=lambda r: r.n)
    last = rows[-1] if rows else None
    r = SessionSet(
        session_id=s.id,
        n=(last.n + 1) if last else 1,
        target_weight_kg=last.target_weight_kg if last else None,
        target_reps=last.target_reps if last else e.reps_min,
        target_rir=e.rir_target,
    )
    e.set_rows.append(r)
    e.sets = r.n
    _bump(s, client_updated_at)
    await db.flush()
    await _record_op(db, s, client_op_id, "add_set", {"set_id": str(r.id)})
    return _set_out(e, r)


async def delete_set(db: AsyncSession, user: User, s: PlannedSession, set_id: uuid.UUID, client_op_id: str) -> None:
    if await _op_result(db, s, client_op_id) is not None:
        return
    _require_open(s)
    e, r = _find_set(s, set_id)
    rows = sorted(e.set_rows, key=lambda x: x.n)
    if rows[-1].id != r.id:
        raise Conflict("Si può togliere solo l'ultima serie.", code="not_last_set")
    if len(rows) <= 1:
        raise Conflict("Un esercizio ha almeno una serie: salta l'esercizio, invece.", code="min_sets")
    e.set_rows.remove(r)
    e.sets = len(rows) - 1
    s.updated_at = datetime.now(UTC)
    await _record_op(db, s, client_op_id, "delete_set", {"set_id": str(set_id)})


async def substitute(db: AsyncSession, user: User, s: PlannedSession, planned_exercise_id: uuid.UUID, new_exercise_id: str, client_op_id: str, client_updated_at: datetime) -> SessionExerciseOut:
    e = next((x for x in s.exercises if x.id == planned_exercise_id), None)
    if e is None:
        raise NotFound("Questo esercizio non è nella seduta.")
    if await _op_result(db, s, client_op_id) is None:
        _require_open(s)
        rules, catalog = await engine_inputs(db)
        profile = await db.get(Profile, user.id)
        allowed = {c.id for c in candidates(catalog, e.slot_pattern, profile_input(profile), exclude={e.exercise_id})}
        if new_exercise_id not in allowed:
            raise UnprocessableError("Questa sostituzione non è tra quelle proposte per lo stesso schema di movimento.", code="invalid_substitute")
        new_ex = await db.get(Exercise, new_exercise_id)
        if e.substituted_from_id is None:
            e.substituted_from_id = e.exercise_id
            e.substituted_from = e.exercise
        e.exercise_id = new_ex.id
        e.exercise = new_ex
        e.rule_refs = {**(e.rule_refs or {}), "selection": "selection.substitute.same_pattern"}
        for r in e.set_rows:
            r.target_weight_kg = None  # esercizio diverso: il carico si ritrova
        _bump(s, client_updated_at)
        await db.flush()
        await _record_op(db, s, client_op_id, "substitute", {"exercise_id": new_exercise_id})
    out = await build_session_out(db, user, s)
    return next(x for x in out.exercises if x.id == e.id)


async def skip_exercise(db: AsyncSession, user: User, s: PlannedSession, planned_exercise_id: uuid.UUID, client_op_id: str, client_updated_at: datetime, *, skipped: bool) -> SessionExerciseOut:
    e = next((x for x in s.exercises if x.id == planned_exercise_id), None)
    if e is None:
        raise NotFound("Questo esercizio non è nella seduta.")
    if await _op_result(db, s, client_op_id) is None:
        _require_open(s)
        e.skipped = skipped
        for r in e.set_rows:
            if skipped and r.status == "todo":
                r.status = "skipped"
            elif not skipped and r.status == "skipped":
                r.status = "todo"
        _bump(s, client_updated_at)
        await _record_op(db, s, client_op_id, "skip" if skipped else "restore", {"exercise_id": str(planned_exercise_id)})
    out = await build_session_out(db, user, s)
    return next(x for x in out.exercises if x.id == e.id)


# ---------------------------------------------------------------- chiusura con progressione


async def close_session(db: AsyncSession, user: User, s: PlannedSession, body: CloseIn) -> tuple[str, SessionOut, NoteBook]:
    index = await KnowledgeIndex.load(db)
    nb = NoteBook(index)
    if (existing := await _op_result(db, s, body.client_op_id)) is not None:
        return s.close_line or "", await build_session_out(db, user, s, nb=nb), nb
    ts = body.client_updated_at if body.client_updated_at.tzinfo else body.client_updated_at.replace(tzinfo=UTC)
    if s.closed_at is None and ts < s.updated_at and body.sets:
        raise ApiError(
            "Ho trovato una seduta più recente sul server. Quale tengo?",
            code="draft_conflict",
            status_code=409,
            server_session=(await build_session_out(db, user, s)).model_dump(mode="json"),
        )
    if s.closed_at is None and ts < s.updated_at and not body.sets:
        raise ApiError(
            "Ho trovato una seduta più recente sul server. Quale tengo?",
            code="draft_conflict",
            status_code=409,
            server_session=(await build_session_out(db, user, s)).model_dump(mode="json"),
        )
    if s.closed_at is not None:
        raise Conflict("La seduta è già chiusa.", code="session_closed")
    for item in body.sets:
        try:
            e, r = _find_set(s, item.set_id)
        except NotFound:
            continue
        _apply_set_fields(r, weight_kg=item.weight_kg, reps=item.reps, rir=item.rir, status=item.status, client_updated_at=ts)
    _bump(s, ts)

    rules, _ = await engine_inputs(db)
    active = [e for e in s.exercises if not e.removed_today and not e.skipped]
    planned_sets = sum(len(e.set_rows) for e in active)
    done_sets = sum(1 for e in active for r in e.set_rows if r.status == "done")
    if done_sets == 0:
        s.status = "skipped"
    elif s.short_version or done_sets < planned_sets * 0.5:
        s.status = "short"
    else:
        s.status = "done"
    s.closed_at = datetime.now(UTC)

    # progressione: la prossima seduta con lo stesso template riceve i nuovi target
    prs: list[str] = []
    if s.status != "skipped":
        nxt = await _next_same_template(db, s)
        history_best = await _best_e1rm_by_exercise(db, user.id, before=s)
        for e in active:
            logged = [LoggedSet(weight_kg=_f(r.logged_weight_kg), reps=r.logged_reps, rir=r.logged_rir) for r in e.set_rows if r.status == "done" and r.logged_reps is not None]
            if not logged:
                continue
            best = max((_e1rm(l.weight_kg, l.reps) for l in logged), default=0.0)
            prev_best = history_best.get(e.exercise_id, 0.0)
            if prev_best > 0 and best > prev_best:  # la prima volta non è un record: non c'è niente da battere
                prs.append(e.exercise.name_it)
            if nxt is None:
                continue
            ne = next((x for x in nxt.exercises if x.exercise_id == e.exercise_id), None)
            if ne is None or nxt.closed_at is not None:
                continue
            presc = Prescription(exercise_id=e.exercise_id, equipment=e.exercise.equipment, pattern=e.slot_pattern, sets=e.sets, reps=(e.reps_min, e.reps_max), rir_target=e.rir_target, rest_s=e.rest_s)
            t = next_targets(presc, logged, rules, previous_weight=max((l.weight_kg or 0) for l in logged) or None)
            w = t.weight_kg
            if nxt.week and nxt.week.is_deload:
                w = deload_weight(w, rules)
            for row in ne.set_rows:
                row.target_weight_kg = Decimal(str(w)) if w is not None else None
                row.target_reps = t.reps
            if t.rule_id:
                ne.rule_refs = {**(ne.rule_refs or {}), "weight": t.rule_id}
                ne.changed_today_label_it = None
    label = {"done": "Seduta chiusa", "short": "Seduta corta chiusa", "skipped": "Seduta segnata come saltata"}[s.status]
    line = f"{label}: {done_sets} serie su {planned_sets}."
    if prs:
        line += f" Record su {', '.join(prs)}."
    if s.status != "skipped":
        line += " La prossima volta i carichi sono già aggiornati[[rule:progression.double.reps_then_load]]."
    s.close_line = nb.mark(line)
    await db.flush()
    await _record_op(db, s, body.client_op_id, "close", {"status": s.status})
    if s.status != "skipped":
        from app.services.plans import count_closed_sessions

        n_closed = (await db.execute(select(PlannedSession.id).where(PlannedSession.user_id == user.id, PlannedSession.closed_at.is_not(None), PlannedSession.status != "skipped"))).all()
        if len(n_closed) == 1:
            await events.record(db, user.id, "first_session_logged", {"session_id": str(s.id)})
    return s.close_line, await build_session_out(db, user, s, nb=nb), nb


def _e1rm(weight: float | None, reps: int) -> float:
    if not weight:
        return 0.0
    return weight * (1 + reps / 30)


async def _best_e1rm_by_exercise(db: AsyncSession, user_id, *, before: PlannedSession) -> dict[str, float]:
    q = (
        select(PlannedExercise.exercise_id, SessionSet.logged_weight_kg, SessionSet.logged_reps)
        .join(SessionSet, SessionSet.planned_exercise_id == PlannedExercise.id)
        .join(PlannedSession, PlannedSession.id == PlannedExercise.session_id)
        .where(PlannedSession.user_id == user_id, PlannedSession.id != before.id, PlannedSession.closed_at.is_not(None), SessionSet.status == "done")
    )
    out: dict[str, float] = {}
    for ex_id, w, reps in (await db.execute(q)).all():
        v = _e1rm(_f(w), reps or 0)
        if v > out.get(ex_id, 0.0):
            out[ex_id] = v
    return out


async def _next_same_template(db: AsyncSession, s: PlannedSession) -> PlannedSession | None:
    q = (
        select(PlannedSession)
        .where(PlannedSession.user_id == s.user_id, PlannedSession.mesocycle_id == s.mesocycle_id, PlannedSession.template_key == s.template_key, PlannedSession.date > s.date)
        .order_by(PlannedSession.date.asc())
        .limit(1)
        .options(*_LOAD)
    )
    return (await db.execute(q)).scalar_one_or_none()


# ---------------------------------------------------------------- sync


async def sync(db: AsyncSession, user: User, s: PlannedSession, ops: list[SyncOpIn]) -> list[SyncResultOut]:
    results: list[SyncResultOut] = []
    for op in ops:
        if await _op_result(db, s, op.client_op_id) is not None:
            results.append(SyncResultOut(client_op_id=op.client_op_id, status="duplicate"))
            continue
        try:
            if op.op == "patch_set":
                if op.set_id is None:
                    raise UnprocessableError("set_id obbligatorio per patch_set.")
                await patch_set(db, user, s, op.set_id, SetPatchIn(client_op_id=op.client_op_id, client_updated_at=op.client_updated_at, weight_kg=op.weight_kg, reps=op.reps, rir=op.rir, status=op.status))
            elif op.op == "add_set":
                if op.exercise_id is None:
                    raise UnprocessableError("exercise_id obbligatorio per add_set.")
                await add_set(db, user, s, op.exercise_id, op.client_op_id, op.client_updated_at)
            elif op.op == "delete_set":
                if op.set_id is None:
                    raise UnprocessableError("set_id obbligatorio per delete_set.")
                await delete_set(db, user, s, op.set_id, op.client_op_id)
            elif op.op == "substitute":
                if op.exercise_id is None or op.new_exercise_id is None:
                    raise UnprocessableError("exercise_id e new_exercise_id obbligatori per substitute.")
                await substitute(db, user, s, op.exercise_id, op.new_exercise_id, op.client_op_id, op.client_updated_at)
            elif op.op in ("skip", "restore"):
                if op.exercise_id is None:
                    raise UnprocessableError("exercise_id obbligatorio.")
                await skip_exercise(db, user, s, op.exercise_id, op.client_op_id, op.client_updated_at, skipped=(op.op == "skip"))
            elif op.op == "close":
                await close_session(db, user, s, CloseIn(client_op_id=op.client_op_id, client_updated_at=max(op.client_updated_at, s.updated_at), sets=op.sets or []))
            results.append(SyncResultOut(client_op_id=op.client_op_id, status="applied"))
        except ApiError as e:
            results.append(SyncResultOut(client_op_id=op.client_op_id, status="error", code=e.code, detail=e.detail))
    return results


async def mesocycle_for_session(db: AsyncSession, s: PlannedSession) -> Mesocycle:
    return await db.get(Mesocycle, s.mesocycle_id)


async def week_for_session(db: AsyncSession, s: PlannedSession) -> PlanWeek:
    return await db.get(PlanWeek, s.week_id)
