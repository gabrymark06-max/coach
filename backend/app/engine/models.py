"""Strutture pure del motore. Nessun import da DB, FastAPI o LLM."""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import date
from typing import Literal

Goal = Literal["hypertrophy", "strength", "health"]
Level = Literal["beginner", "intermediate"]
Tier = Literal["beginner", "intermediate", "health"]
Split = Literal["full_body", "upper_lower", "ppl"]
Location = Literal["gym", "home_dumbbells", "bodyweight"]

ENGINE_VERSION = "1.0"


@dataclass(frozen=True)
class ProfileInput:
    goal: Goal
    level: Level
    days_per_week: int
    minutes_per_session: int
    location: Location
    equipment: list[str] = field(default_factory=list)  # extra: band, pull_up_bar
    avoid_patterns: list[str] = field(default_factory=list)
    conservative: bool = False

    @property
    def tier(self) -> Tier:
        return "health" if self.goal == "health" else self.level


@dataclass(frozen=True)
class Rule:
    id: str
    version: int
    governs: str
    applies_to: dict
    value: dict
    grade: str | None
    citations: list[str]
    title_it: str
    summary_it: str
    not_says_it: str
    is_own_note: bool
    rationale_it: str | None
    updated_at: date


@dataclass(frozen=True)
class ExerciseSpec:
    """Un esercizio del catalogo."""

    id: str
    name_it: str
    name_en: str
    pattern: str
    primary_muscle: str
    secondary: list[str]
    equipment: str
    mechanic: str
    spinal_load: str
    min_tier: str
    requires: str | None
    instructions_it: list[str]
    ds_id: str | None


@dataclass
class SetTarget:
    n: int
    target_weight_kg: float | None
    target_reps: int
    target_rir: int


@dataclass
class PlannedExerciseSpec:
    exercise_id: str
    name_it: str
    pattern: str
    primary_muscle: str
    equipment: str
    mechanic: str
    spinal_load: str
    order: int
    sets: int
    reps: tuple[int, int]
    rest_s: int
    rir_target: int
    rule_refs: dict[str, str]
    set_targets: list[SetTarget] = field(default_factory=list)
    removed_today: bool = False
    removed_reason_it: str | None = None
    removed_rule_id: str | None = None
    changed_today_label_it: str | None = None
    substituted_from_id: str | None = None

    def rebuild_sets(self, weight: float | None = None) -> None:
        keep_w = {s.n: s.target_weight_kg for s in self.set_targets}
        self.set_targets = [
            SetTarget(n=i + 1, target_weight_kg=keep_w.get(i + 1, weight), target_reps=self.reps[0], target_rir=self.rir_target)
            for i in range(self.sets)
        ]


@dataclass
class SessionSpec:
    template_key: str
    name: str
    index_in_week: int
    sessions_in_week: int
    date: date
    exercises: list[PlannedExerciseSpec]
    est_minutes: int = 0
    short_version: bool = False
    rule_ids: list[str] = field(default_factory=list)

    def active_exercises(self) -> list[PlannedExerciseSpec]:
        return [e for e in self.exercises if not e.removed_today]


@dataclass
class WeekSpec:
    n: int
    is_deload: bool
    is_maintenance: bool
    label_it: str
    starts_on: date
    changes: list[dict]
    sessions: list[SessionSpec]


@dataclass
class MesoPlan:
    index: int
    split: Split
    tier: Tier
    total_weeks: int
    started_on: date
    weeks: list[WeekSpec]
    rule_ids: set[str]
    engine_version: str = ENGINE_VERSION


# ---------------------------------------------------------------- progressione


@dataclass(frozen=True)
class Prescription:
    exercise_id: str
    equipment: str
    pattern: str
    sets: int
    reps: tuple[int, int]
    rir_target: int
    rest_s: int


@dataclass(frozen=True)
class LoggedSet:
    weight_kg: float | None
    reps: int
    rir: int | None


@dataclass(frozen=True)
class NextTargets:
    weight_kg: float | None
    reps: int
    rule_id: str | None
    label_it: str | None


# ---------------------------------------------------------------- readiness


@dataclass(frozen=True)
class ReadinessInput:
    sleep: Literal["lt6", "6to8", "gt8"]
    mood: Literal["low", "mid", "high"]
    pain: Literal["none", "mild", "severe"]


@dataclass
class RemovedExercise:
    exercise_id: str
    name_it: str
    reason_it: str
    rule_id: str


@dataclass
class ChangedSet:
    exercise_id: str
    field: str  # sets | reps | weight | rest | rir
    from_value: int | float | None
    to_value: int | float | None


@dataclass
class ReadinessDiff:
    removed_exercises: list[RemovedExercise] = field(default_factory=list)
    changed_sets: list[ChangedSet] = field(default_factory=list)
    short_version: bool = False
    est_minutes: int = 0


@dataclass
class SafetyOption:
    id: str
    label: str


@dataclass
class SafetyBlock:
    text: str
    options: list[SafetyOption]
    rule_id: str


@dataclass
class ReadinessResult:
    session: SessionSpec
    diff: ReadinessDiff
    coach_line: str  # con marcatori [[rule:ID]]
    rule_ids: list[str]
    safety: SafetyBlock | None


def clone_session(s: SessionSpec) -> SessionSpec:
    return replace(
        s,
        exercises=[
            replace(e, set_targets=[replace(t) for t in e.set_targets], rule_refs=dict(e.rule_refs))
            for e in s.exercises
        ],
        rule_ids=list(s.rule_ids),
    )
