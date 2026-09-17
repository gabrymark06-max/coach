"""Readiness in 10 secondi -> il piano di oggi cambia, e lo dice. Puro."""

from __future__ import annotations

from app.engine.models import (
    ChangedSet,
    ReadinessDiff,
    ReadinessInput,
    ReadinessResult,
    RemovedExercise,
    Rule,
    SafetyBlock,
    SafetyOption,
    SessionSpec,
    clone_session,
)
from app.engine.plan import estimate_minutes, short_version

SAFETY_TEXT_SEVERE = (
    "Un dolore forte non lo valuta un'app. Oggi il piano si ferma qui: prima senti un medico o un fisioterapista. "
    "Se il dolore è al petto, o hai vertigini o fiato corto, chiama il 112."
)
SAFETY_OPTIONS = [
    SafetyOption(id="pause_plan", label="Metti in pausa il piano"),
    SafetyOption(id="remove_exercise", label="Togli l'esercizio che fa male"),
    SafetyOption(id="continue_anyway", label="Ho capito, vado comunque alla seduta"),
]


def adapt_for_readiness(session: SessionSpec, r: ReadinessInput, rules: dict[str, Rule]) -> ReadinessResult:
    if r.pain == "severe":
        rule = rules["readiness.pain.severe"]
        return ReadinessResult(
            session=clone_session(session),
            diff=ReadinessDiff(est_minutes=session.est_minutes),
            coach_line=f"Oggi il piano si ferma: prima un professionista[[rule:{rule.id}]].",
            rule_ids=[rule.id],
            safety=SafetyBlock(text=SAFETY_TEXT_SEVERE, options=list(SAFETY_OPTIONS), rule_id=rule.id),
        )

    out = clone_session(session)
    diff = ReadinessDiff()
    rule_ids: list[str] = []
    lines: list[str] = []

    if r.pain == "mild":
        rule = rules["readiness.pain.mild"]
        rule_ids.append(rule.id)
        for e in out.exercises:
            if e.removed_today:
                continue
            if e.spinal_load == rule.value["remove_spinal_load"]:
                e.removed_today = True
                e.removed_reason_it = "Dolore lieve: oggi niente carichi sulla colonna"
                e.removed_rule_id = rule.id
                diff.removed_exercises.append(RemovedExercise(e.exercise_id, e.name_it, e.removed_reason_it, rule.id))
        delta = int(rule.value["rir_delta"])
        for e in out.active_exercises():
            diff.changed_sets.append(ChangedSet(e.exercise_id, "rir", e.rir_target, e.rir_target + delta))
            e.rir_target += delta
            e.rule_refs["rir"] = rule.id
            e.rebuild_sets()
        removed_names = ", ".join(x.name_it.lower() for x in diff.removed_exercises)
        lines.append(
            (f"Tolgo {removed_names} e " if removed_names else "") + f"tengo una ripetizione in riserva in più[[rule:{rule.id}]]"
        )

    low = rules["readiness.low.short_version"]
    if r.sleep in low.value["sleep"] or r.mood in low.value["mood"]:
        rule_ids.append(low.id)
        out = _shorten_with_diff(out, diff, rules)
        rule_ids.append(rules["session.short_version"].id)
        why = "poco sonno" if r.sleep in low.value["sleep"] else "poca voglia"
        lines.append(f"{why.capitalize()}: oggi versione corta, stessi carichi[[rule:{low.id}]]")

    out.est_minutes = estimate_minutes(out, rules)
    diff.est_minutes = out.est_minutes
    if not lines:
        coach_line = "Tutto a posto: oggi il piano resta com'è."
    else:
        coach_line = ". ".join(lines) + f". Durata: {out.est_minutes} minuti."
    return ReadinessResult(session=out, diff=diff, coach_line=coach_line, rule_ids=rule_ids, safety=None)


def _shorten_with_diff(session: SessionSpec, diff: ReadinessDiff, rules: dict[str, Rule]) -> SessionSpec:
    """Applica session.short_version e annota nel diff cosa è cambiato (esercizi tolti, serie, riposo)."""
    before = {e.exercise_id: (e.sets, e.rest_s) for e in session.active_exercises()}
    out = short_version(session, rules)
    for e in out.exercises:
        if e.removed_today and e.removed_rule_id == "session.short_version":
            diff.removed_exercises.append(RemovedExercise(e.exercise_id, e.name_it, e.removed_reason_it or "", e.removed_rule_id))
        elif not e.removed_today and e.exercise_id in before:
            b_sets, b_rest = before[e.exercise_id]
            if e.sets != b_sets:
                diff.changed_sets.append(ChangedSet(e.exercise_id, "sets", b_sets, e.sets))
            if e.rest_s != b_rest:
                diff.changed_sets.append(ChangedSet(e.exercise_id, "rest", b_rest, e.rest_s))
    diff.short_version = True
    return out


def shorten(session: SessionSpec, rules: dict[str, Rule]) -> ReadinessResult:
    """Versione corta scelta dall'anteprima di Oggi, senza questionario: stesso motore, stesso diff della readiness."""
    rule = rules["session.short_version"]
    diff = ReadinessDiff()
    out = _shorten_with_diff(session, diff, rules)
    out.est_minutes = estimate_minutes(out, rules)
    diff.est_minutes = out.est_minutes
    coach_line = f"Versione corta: gli esercizi principali, {int(rule.value['sets'])} serie, stessi carichi[[rule:{rule.id}]]. Durata: {out.est_minutes} minuti."
    return ReadinessResult(session=out, diff=diff, coach_line=coach_line, rule_ids=[rule.id], safety=None)
