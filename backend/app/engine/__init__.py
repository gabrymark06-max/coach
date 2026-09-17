"""Motore di programmazione deterministico. Modulo puro: nessun DB, nessun LLM.

Input: profilo + regole + catalogo (+ storico) -> output: piano con rule_id su ogni parametro.
"""

from app.engine.models import (
    ExerciseSpec,
    LoggedSet,
    MesoPlan,
    NextTargets,
    PlannedExerciseSpec,
    Prescription,
    ProfileInput,
    ReadinessInput,
    ReadinessResult,
    Rule,
    SessionSpec,
    WeekSpec,
)
from app.engine.plan import (
    available_equipment,
    candidates,
    estimate_minutes,
    generate_mesocycle,
    maintenance_week,
    short_version,
    substitutes_for,
)
from app.engine.progression import deload_weight, next_targets, return_after_break_weight
from app.engine.readiness import adapt_for_readiness, shorten
from app.engine.rules import (
    catalog_from_rows,
    load_catalog,
    load_citations,
    load_rules,
    rules_from_rows,
)

__all__ = [
    "ExerciseSpec",
    "LoggedSet",
    "MesoPlan",
    "NextTargets",
    "PlannedExerciseSpec",
    "Prescription",
    "ProfileInput",
    "ReadinessInput",
    "ReadinessResult",
    "Rule",
    "SessionSpec",
    "WeekSpec",
    "available_equipment",
    "candidates",
    "estimate_minutes",
    "generate_mesocycle",
    "maintenance_week",
    "short_version",
    "substitutes_for",
    "deload_weight",
    "next_targets",
    "return_after_break_weight",
    "adapt_for_readiness",
    "shorten",
    "catalog_from_rows",
    "load_catalog",
    "load_citations",
    "load_rules",
    "rules_from_rows",
]
