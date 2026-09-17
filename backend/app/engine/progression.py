"""Progressione doppia guidata dal RIR loggato. Puro."""

from __future__ import annotations

from app.engine.models import LoggedSet, NextTargets, Prescription, Rule

LOWER_PATTERNS = {"squat", "hinge", "lunge", "glute", "quad_iso", "ham_iso", "calf"}


def _round_half(x: float) -> float:
    return round(x * 2) / 2


def increment_for(presc: Prescription, rules: dict[str, Rule]) -> tuple[float | None, int]:
    """(incremento in kg, incremento in ripetizioni per chi non ha carico)."""
    v = rules["progression.load.increment"].value
    eq = presc.equipment
    if eq == "barbell":
        return (float(v["barbell_lower_kg"]) if presc.pattern in LOWER_PATTERNS else float(v["barbell_upper_kg"])), 0
    if eq == "dumbbell":
        return float(v["dumbbell_kg"]), 0
    if eq == "machine":
        return float(v["machine_kg"]), 0
    if eq == "cable":
        return float(v["cable_kg"]), 0
    return None, int(v["bodyweight_reps"])


def next_targets(
    presc: Prescription, logged: list[LoggedSet], rules: dict[str, Rule], *, previous_weight: float | None = None
) -> NextTargets:
    done = [s for s in logged if s.reps is not None]
    if not done:
        return NextTargets(weight_kg=previous_weight, reps=presc.reps[0], rule_id=None, label_it=None)

    reps_min, reps_max = presc.reps
    weights = [s.weight_kg for s in done if s.weight_kg is not None]
    weight = max(weights) if weights else None
    min_reps = min(s.reps for s in done)
    rirs = [s.rir for s in done if s.rir is not None]
    min_rir = min(rirs) if rirs else presc.rir_target
    inc_kg, inc_reps = increment_for(presc, rules)

    too_hard = rules["progression.reduce_when_too_hard"]
    if min_rir <= presc.rir_target - int(too_hard.value["rir_deficit"]) or min_reps < reps_min:
        if weight is not None:
            new_w = _round_half(weight * (1 - float(too_hard.value["reduce_pct"]) / 100))
            return NextTargets(weight_kg=new_w, reps=reps_min, rule_id=too_hard.id, label_it=f"{new_w:g} kg invece di {weight:g}")
        new_reps = max(reps_min, min_reps - inc_reps)
        return NextTargets(weight_kg=None, reps=new_reps, rule_id=too_hard.id, label_it=f"{new_reps} ripetizioni")

    double = rules["progression.double.reps_then_load"]
    all_top = all(s.reps >= reps_max for s in done) and min_rir >= presc.rir_target
    if all_top:
        if weight is not None and inc_kg is not None:
            new_w = _round_half(weight + inc_kg)
            return NextTargets(weight_kg=new_w, reps=reps_min, rule_id=double.id, label_it=f"{new_w:g} kg, riparti da {reps_min}")
        new_reps = min(30, min_reps + inc_reps)
        return NextTargets(weight_kg=weight, reps=new_reps, rule_id=double.id, label_it=f"{new_reps} ripetizioni")
    new_reps = min(reps_max, max(reps_min, min_reps + 1))
    return NextTargets(weight_kg=weight, reps=new_reps, rule_id=double.id, label_it=f"{new_reps} ripetizioni")


def deload_weight(weight: float | None, rules: dict[str, Rule]) -> float | None:
    if weight is None:
        return None
    return _round_half(weight * float(rules["deload.volume_and_load"].value["load_factor"]))


def return_after_break_weight(weight: float | None, rules: dict[str, Rule]) -> float | None:
    if weight is None:
        return None
    return _round_half(weight * float(rules["return.after_break"].value["load_factor"]))
