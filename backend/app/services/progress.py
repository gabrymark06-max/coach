"""Progressi: costanza (fatte e ritorni, mai streak), grafici per esercizio, PR. In free lo storico è di 8 settimane."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clock import today_local
from app.config import Settings
from app.errors import NotFound
from app.models import Exercise, PlannedExercise, PlannedSession, SessionSet, User
from app.schemas.plans import ConsistencyDayOut, ConsistencyOut, PrOut, ProgressExerciseOut, ProgressHistoryOut, ProgressPointOut
from app.services.notes import KnowledgeIndex, note_for_rule


def _f(x) -> float | None:
    return float(x) if x is not None else None


async def consistency(db: AsyncSession, settings: Settings, user: User, *, weeks: int, pro: bool, today: date | None = None) -> ConsistencyOut:
    today = today or today_local(settings.timezone)
    weeks = max(1, min(weeks, 52 if pro else settings.free_history_weeks))
    limited = not pro
    # finestra: `weeks` settimane che finiscono con la settimana corrente (lun-dom)
    end = today + timedelta(days=6 - today.weekday())
    start = end - timedelta(days=7 * weeks - 1)
    q = select(PlannedSession).where(PlannedSession.user_id == user.id, PlannedSession.date >= start, PlannedSession.date <= end).order_by(PlannedSession.date)
    sessions = (await db.execute(q)).scalars().all()
    by_date: dict[date, PlannedSession] = {}
    for s in sessions:
        by_date.setdefault(s.date, s)
    days: list[ConsistencyDayOut] = []
    done = planned = returns = 0
    prev_skipped = False
    d = start
    while d <= end:
        s = by_date.get(d)
        if s is None:
            status = "none"
            if start <= d <= today and sessions:
                status = "rest"
            if d > today:
                status = "future"
            days.append(ConsistencyDayOut(date=d, status=status))
        else:
            if d > today and s.status == "planned":
                status = "future"  # non ancora dovuta: non entra in `planned`
            elif d == today and s.status == "planned":
                status = "future"  # in programma oggi: conta tra le pianificate, non è ancora "non fatta"
                planned += 1
            elif s.status in ("done", "short"):
                status = "return" if prev_skipped else ("short" if s.status == "short" else "done")
                if prev_skipped:
                    returns += 1
                prev_skipped = False
                done += 1
                planned += 1
            elif s.status == "skipped" or (s.status == "planned" and d < today):
                status = "skipped"
                prev_skipped = True
                planned += 1
            else:
                status = "future" if d > today else "rest"
            days.append(ConsistencyDayOut(date=d, status=status, session_id=s.id))
        d += timedelta(days=1)
    n_short = sum(1 for x in days if x.status == "short")
    n_skipped = sum(1 for x in days if x.status == "skipped")
    if done == 0 and n_skipped == 0:  # niente ancora deciso (al più la seduta di oggi, in programma)
        caption = "Prima settimana: la mappa si riempie da qui."
    else:
        def _n(n: int, sing: str, plur: str) -> str:
            return f"{n} {sing if n == 1 else plur}"

        caption = _n(done, "seduta fatta", "sedute fatte") + (", " + _n(n_short, "corta", "corte") if n_short else "") + (", " + _n(n_skipped, "non fatta", "non fatte") if n_skipped else "") + "."
        if returns:
            caption += f" Sei tornato {returns} {'volta' if returns == 1 else 'volte'}."
    index = await KnowledgeIndex.load(db)
    return ConsistencyOut(done=done, planned=planned, returns=returns, days=days, caption_it=caption, note=note_for_rule(index, "system.consistency"), window_limited_by_plan=limited)


async def exercises_overview(db: AsyncSession, user: User) -> list[ProgressExerciseOut]:
    q = (
        select(PlannedExercise.exercise_id, Exercise.name_it, SessionSet.logged_weight_kg, SessionSet.logged_reps, PlannedSession.date, PlannedSession.closed_at)
        .join(SessionSet, SessionSet.planned_exercise_id == PlannedExercise.id)
        .join(PlannedSession, PlannedSession.id == PlannedExercise.session_id)
        .join(Exercise, Exercise.id == PlannedExercise.exercise_id)
        .where(PlannedSession.user_id == user.id, PlannedSession.closed_at.is_not(None), SessionSet.status == "done", SessionSet.logged_weight_kg.is_not(None))
        .order_by(PlannedSession.closed_at.desc())
    )
    rows = (await db.execute(q)).all()
    out: dict[str, ProgressExerciseOut] = {}
    best: dict[str, tuple[float, int, date]] = {}
    for ex_id, name, w, reps, d, _ in rows:
        w = float(w)
        if ex_id not in out:
            out[ex_id] = ProgressExerciseOut(exercise_id=ex_id, name_it=name, last_weight_kg=w, pr=None)
        cur = best.get(ex_id)
        if cur is None or (w, reps or 0) > (cur[0], cur[1]):
            best[ex_id] = (w, reps or 0, d)
    for ex_id, (w, reps, d) in best.items():
        out[ex_id].pr = PrOut(weight_kg=w, reps=reps, date=d)
    return sorted(out.values(), key=lambda x: x.name_it)


async def exercise_history(db: AsyncSession, settings: Settings, user: User, exercise_id: str, *, since: date | None, pro: bool, today: date | None = None) -> ProgressHistoryOut:
    today = today or today_local(settings.timezone)
    ex = await db.get(Exercise, exercise_id)
    if ex is None:
        raise NotFound("Questo esercizio non esiste.")
    floor = today - timedelta(weeks=settings.free_history_weeks)
    limited = False
    if not pro and (since is None or since < floor):
        since = floor
        limited = True
    since = since or date(2000, 1, 1)
    q = (
        select(PlannedSession.date, PlannedSession.week_n, SessionSet.logged_weight_kg, SessionSet.logged_reps)
        .join(PlannedExercise, PlannedExercise.session_id == PlannedSession.id)
        .join(SessionSet, SessionSet.planned_exercise_id == PlannedExercise.id)
        .where(PlannedSession.user_id == user.id, PlannedExercise.exercise_id == exercise_id, PlannedSession.closed_at.is_not(None), SessionSet.status == "done", PlannedSession.date >= since)
        .order_by(PlannedSession.date)
    )
    by_day: dict[date, tuple[int, float | None, int]] = {}
    for d, week, w, reps in (await db.execute(q)).all():
        wf = _f(w)
        cur = by_day.get(d)
        if cur is None or (wf or 0, reps or 0) > (cur[1] or 0, cur[2]):
            by_day[d] = (week, wf, reps or 0)
    points: list[ProgressPointOut] = []
    best = 0.0
    for d in sorted(by_day):
        week, wf, reps = by_day[d]
        is_pr = (wf or 0) > best
        best = max(best, wf or 0)
        points.append(ProgressPointOut(date=d, week=week, best_weight_kg=wf, reps=reps, is_pr=is_pr))
    return ProgressHistoryOut(exercise_id=exercise_id, name_it=ex.name_it, points=points, history_limited=limited, since=since)
