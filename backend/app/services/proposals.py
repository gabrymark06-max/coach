"""plan_change_proposals: il coach (o l'utente da Settimana) propone, il motore valida, l'utente conferma.

Audit trail: ogni proposta ha stato proposta / accettata / rifiutata / non valida.
"""

from __future__ import annotations

import re
import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.clock import today_local
from app.engine import candidates
from app.errors import Conflict, NotFound, PlanRequired
from app.models import Exercise, PlanChangeProposal, PlannedExercise, PlannedSession, Profile, SessionSet, User
from app.schemas.plans import ProposalDiffOut, ProposalOut, ProposalPatchIn
from app.services import entitlements as ent_service
from app.services import plans as plans_service
from app.services.notes import KnowledgeIndex, NoteBook

_LOAD = (selectinload(PlannedSession.exercises).selectinload(PlannedExercise.set_rows), selectinload(PlannedSession.exercises).selectinload(PlannedExercise.exercise), selectinload(PlannedSession.week))


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]", " ", s.lower())


async def _future_sessions(db: AsyncSession, user_id, meso_id, today: date) -> list[PlannedSession]:
    q = select(PlannedSession).where(PlannedSession.user_id == user_id, PlannedSession.mesocycle_id == meso_id, PlannedSession.closed_at.is_(None), PlannedSession.date >= today).options(*_LOAD).order_by(PlannedSession.date)
    return list((await db.execute(q)).scalars().all())


def _match_exercises(sessions: list[PlannedSession], patch: ProposalPatchIn) -> list[PlannedExercise]:
    if patch.exercise_id is not None:
        base = [e for s in sessions for e in s.exercises if e.id == patch.exercise_id]
        if not base:
            return []
        if patch.scope == "session":
            return base
        ex_id = base[0].exercise_id
        return [e for s in sessions for e in s.exercises if e.exercise_id == ex_id and (patch.session_id is None or s.date >= next(x.date for x in sessions if x.id == patch.session_id))]
    if patch.exercise_query:
        q = _norm(patch.exercise_query)
        words = [w for w in q.split() if len(w) > 3]
        found: list[PlannedExercise] = []
        for s in sessions:
            if patch.session_id is not None and s.id != patch.session_id:
                continue
            for e in s.exercises:
                name = _norm(e.exercise.name_it) + " " + _norm(e.exercise.name_en)
                if any(w in name for w in words):
                    found.append(e)
        if patch.scope == "session" and found:
            first_session = found[0].session_id
            return [e for e in found if e.session_id == first_session]
        # stesso esercizio in tutte le sedute future
        if found:
            ex_id = found[0].exercise_id
            return [e for e in found if e.exercise_id == ex_id]
    return []


async def create_proposal(db: AsyncSession, user: User, patch: ProposalPatchIn, *, origin: str, message_id: uuid.UUID | None = None) -> tuple[PlanChangeProposal, ProposalOut]:
    today = today_local()
    meso = await plans_service.require_mesocycle(db, user.id)
    ent = await ent_service.get_entitlement(db, user)
    if not ent_service.engine_active(ent, meso) or meso.status != "active":
        raise PlanRequired()
    rules, catalog = await plans_service.engine_inputs(db)
    index = await KnowledgeIndex.load(db)
    nb = NoteBook(index)
    sessions = await _future_sessions(db, user.id, meso.id, today)
    diff: list[ProposalDiffOut] = []
    invalid: str | None = None
    resolved: dict = {}

    if patch.op == "adjust_sets":
        # il deload deriva dalle settimane di allenamento: non si tocca a mano
        targets = [e for e in _match_exercises([s for s in sessions if not s.week.is_deload], patch)]
        if not targets:
            invalid = "Non trovo questo esercizio nelle sedute che restano."
        elif not patch.delta:
            invalid = "Serve dire di quante serie."
        else:
            bounds = rules["volume.sets_per_exercise.bounds"].value
            hi = {"beginner": bounds.get("max_beginner", bounds["max"]), "health": bounds.get("max_health", bounds["max"])}.get(meso.tier, bounds["max"])
            n_note = nb.n("volume.sets_per_exercise.bounds")
            for e in targets:
                new = e.sets + patch.delta
                if new < bounds["min"] or new > hi:
                    invalid = f"{e.exercise.name_it}: {new} serie è fuori dai limiti ({bounds['min']}-{hi} per esercizio)."
                    break
                diff.append(ProposalDiffOut(exercise=e.exercise.name_it, field="sets", **{"from": e.sets, "to": new}, note_n=n_note))
            resolved = {"planned_exercise_ids": [str(e.id) for e in targets], "delta": patch.delta}
    elif patch.op == "substitute":
        targets = _match_exercises(sessions, patch)
        if not targets:
            invalid = "Non trovo questo esercizio nelle sedute che restano."
        elif not patch.new_exercise_id:
            invalid = "Serve dire con quale esercizio."
        else:
            profile = await db.get(Profile, user.id)
            base = targets[0]
            allowed = {c.id: c for c in candidates(catalog, base.slot_pattern, plans_service.profile_input(profile), exclude={base.exercise_id})}
            new = allowed.get(patch.new_exercise_id)
            if new is None:
                invalid = "Questa sostituzione non rispetta lo schema di movimento o l'attrezzatura che hai."
            else:
                n_note = nb.n("selection.substitute.same_pattern")
                for e in targets:
                    diff.append(ProposalDiffOut(exercise=e.exercise.name_it, field="exercise", **{"from": e.exercise.name_it, "to": new.name_it}, note_n=n_note))
                resolved = {"planned_exercise_ids": [str(e.id) for e in targets], "new_exercise_id": new.id}
    elif patch.op == "move_session":
        s = next((x for x in sessions if x.id == patch.session_id), None) if patch.session_id else (sessions[0] if sessions else None)
        if s is None:
            invalid = "Non trovo questa seduta tra quelle che restano."
        elif not patch.new_day_offset:
            invalid = "Serve dire di quanti giorni."
        else:
            new_date = s.date + timedelta(days=patch.new_day_offset)
            week_start = meso.started_on + timedelta(days=7 * (s.week_n - 1))
            if not (week_start <= new_date <= week_start + timedelta(days=6)):
                invalid = "La seduta può muoversi solo dentro la sua settimana."
            elif any(x.date == new_date and x.id != s.id for x in sessions):
                invalid = "Quel giorno c'è già una seduta."
            elif new_date < today:
                invalid = "Non si sposta una seduta nel passato."
            else:
                diff.append(ProposalDiffOut(exercise=s.name, field="date", **{"from": s.date.isoformat(), "to": new_date.isoformat()}, note_n=None))
                resolved = {"session_id": str(s.id), "new_date": new_date.isoformat()}

    p = PlanChangeProposal(
        user_id=user.id,
        mesocycle_id=meso.id,
        message_id=message_id,
        origin=origin,
        patch={**patch.model_dump(mode="json"), "resolved": resolved},
        diff=[d.model_dump(mode="json", by_alias=True) for d in diff],
        status="invalid" if invalid else "proposed",
        invalid_reason_it=invalid,
        resolved_at=datetime.now(UTC) if invalid else None,
    )
    db.add(p)
    await db.flush()
    return p, ProposalOut(proposal_id=p.id, status=p.status, diff=diff, notes=nb.notes(), valid=invalid is None, invalid_reason_it=invalid)


async def _get(db: AsyncSession, user: User, proposal_id: uuid.UUID) -> PlanChangeProposal:
    p = (await db.execute(select(PlanChangeProposal).where(PlanChangeProposal.id == proposal_id, PlanChangeProposal.user_id == user.id))).scalar_one_or_none()
    if p is None:
        raise NotFound("Questa proposta non esiste.")
    return p


def _out(p: PlanChangeProposal, nb: NoteBook) -> ProposalOut:
    return ProposalOut(proposal_id=p.id, status=p.status, diff=[ProposalDiffOut(**d) for d in (p.diff or [])], notes=nb.notes(), valid=p.status != "invalid", invalid_reason_it=p.invalid_reason_it)


async def apply_proposal(db: AsyncSession, user: User, proposal_id: uuid.UUID) -> ProposalOut:
    p = await _get(db, user, proposal_id)
    if p.status != "proposed":
        raise Conflict("Questa proposta non è più applicabile.", code="proposal_not_applicable")
    meso = await plans_service.require_mesocycle(db, user.id)
    ent = await ent_service.get_entitlement(db, user)
    if not ent_service.engine_active(ent, meso) or meso.status != "active":
        raise PlanRequired()
    patch = p.patch or {}
    resolved = patch.get("resolved") or {}
    op = patch.get("op")
    if op == "adjust_sets":
        ids = [uuid.UUID(x) for x in resolved.get("planned_exercise_ids", [])]
        rows = (await db.execute(select(PlannedExercise).where(PlannedExercise.id.in_(ids)).options(selectinload(PlannedExercise.set_rows)))).scalars().all()
        delta = int(resolved.get("delta", 0))
        for e in rows:
            new = e.sets + delta
            srows = sorted(e.set_rows, key=lambda r: r.n)
            if delta > 0:
                last = srows[-1] if srows else None
                for n in range(len(srows) + 1, new + 1):
                    e.set_rows.append(SessionSet(session_id=e.session_id, n=n, target_weight_kg=last.target_weight_kg if last else None, target_reps=last.target_reps if last else e.reps_min, target_rir=e.rir_target))
            else:
                for r in srows[new:]:
                    if r.status == "todo":
                        e.set_rows.remove(r)
            e.sets = new
            e.rule_refs = {**(e.rule_refs or {}), "sets": "volume.sets_per_exercise.bounds"}
    elif op == "substitute":
        ids = [uuid.UUID(x) for x in resolved.get("planned_exercise_ids", [])]
        rows = (await db.execute(select(PlannedExercise).where(PlannedExercise.id.in_(ids)).options(selectinload(PlannedExercise.set_rows)))).scalars().all()
        new_ex = await db.get(Exercise, resolved.get("new_exercise_id"))
        for e in rows:
            if e.substituted_from_id is None:
                e.substituted_from_id = e.exercise_id
            e.exercise_id = new_ex.id
            e.rule_refs = {**(e.rule_refs or {}), "selection": "selection.substitute.same_pattern"}
            for r in e.set_rows:
                r.target_weight_kg = None
    elif op == "move_session":
        s = await db.get(PlannedSession, uuid.UUID(resolved["session_id"]))
        if s is not None and s.user_id == user.id:
            s.date = date.fromisoformat(resolved["new_date"])
            s.updated_at = datetime.now(UTC)
    p.status = "accepted"
    p.resolved_at = datetime.now(UTC)
    await _mark_message(db, p, applied=True)
    await db.flush()
    return _out(p, NoteBook(await KnowledgeIndex.load(db)))


async def reject_proposal(db: AsyncSession, user: User, proposal_id: uuid.UUID) -> ProposalOut:
    p = await _get(db, user, proposal_id)
    if p.status != "proposed":
        raise Conflict("Questa proposta non è più applicabile.", code="proposal_not_applicable")
    p.status = "rejected"
    p.resolved_at = datetime.now(UTC)
    await _mark_message(db, p, applied=False)
    await db.flush()
    return _out(p, NoteBook(await KnowledgeIndex.load(db)))


async def get_proposal(db: AsyncSession, user: User, proposal_id: uuid.UUID) -> ProposalOut:
    p = await _get(db, user, proposal_id)
    return _out(p, NoteBook(await KnowledgeIndex.load(db)))


async def _mark_message(db: AsyncSession, p: PlanChangeProposal, *, applied: bool) -> None:
    """Aggiorna il blocco plan_change nel messaggio del coach che l'ha proposta."""
    from app.models import ChatMessage

    if p.message_id is None:
        return
    m = await db.get(ChatMessage, p.message_id)
    if m is None:
        return
    blocks = []
    for b in m.blocks or []:
        if b.get("type") == "plan_change" and b.get("proposal_id") == str(p.id):
            b = {**b, "applied": applied}
        blocks.append(b)
    m.blocks = blocks
