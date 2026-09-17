"""Forme di onboarding, piano, seduta, readiness, oggi, progressi, riepilogo (design-system §9.3-9.10)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import IntWithNote, Note, RangeWithNote

# ---------------------------------------------------------------- onboarding


class OptionOut(BaseModel):
    id: str
    label_it: str
    help_it: str | None = None


class FieldOut(BaseModel):
    id: str
    type: Literal["single", "multi", "text"]
    label_it: str
    help_it: str | None = None
    options: list[OptionOut] = []
    required: bool = True


class StepOut(BaseModel):
    id: str
    title_it: str
    fields: list[FieldOut]


class ConsentOut(BaseModel):
    label_it: str
    text_it: str
    note: Note


class GateQuestionOut(BaseModel):
    id: str
    text_it: str
    blocking: bool


class GateOut(BaseModel):
    title_it: str
    intro_it: str
    questions: list[GateQuestionOut]
    blocking_text_it: str
    acknowledge_label_it: str
    note: Note


class OnboardingSchemaOut(BaseModel):
    steps: list[StepOut]
    consent: ConsentOut
    disclaimer_it: str
    gate: GateOut


class OnboardingIn(BaseModel):
    goal: Literal["hypertrophy", "strength", "health"]
    level: Literal["beginner", "intermediate"]
    days_per_week: int = Field(ge=2, le=6)
    minutes_per_session: Literal[30, 45, 60, 75]
    location: Literal["gym", "home_dumbbells", "bodyweight"]
    equipment: list[Literal["band", "pull_up_bar"]] = []
    health_consent: bool = False
    constraints_text: str | None = Field(default=None, max_length=1000)
    safety_answers: dict[str, bool]
    safety_acknowledged: bool = False

    @model_validator(mode="after")
    def _answers_complete(self) -> OnboardingIn:
        expected = {f"q{i}" for i in range(1, 8)}
        if set(self.safety_answers) != expected:
            raise ValueError("safety_answers deve contenere q1..q7")
        return self


class MesocycleBriefOut(BaseModel):
    index: int
    week: int
    total_weeks: int
    status: Literal["active", "maintenance", "completed"]


class OnboardingOut(BaseModel):
    mesocycle: MesocycleBriefOut
    first_session_id: uuid.UUID
    coach_comment_message_id: uuid.UUID
    safety_notice_it: str | None = None


class HealthConsentIn(BaseModel):
    given: bool


class HealthConsentOut(BaseModel):
    given: bool
    given_at: datetime | None
    detail: str


# ---------------------------------------------------------------- seduta


class MediaOut(BaseModel):
    gif_url: str | None
    poster_url: str | None
    attribution: str | None = None


class PrescriptionOut(BaseModel):
    sets: IntWithNote
    reps: RangeWithNote
    rest_s: IntWithNote
    rir_target: IntWithNote


class SetTargetOut(BaseModel):
    weight_kg: float | None
    reps: int
    rir: int


class SetPreviousOut(BaseModel):
    weight_kg: float | None
    reps: int | None
    rir: int | None
    date: date


class SetLoggedOut(BaseModel):
    weight_kg: float | None
    reps: int | None
    rir: int | None
    status: Literal["todo", "done", "skipped"]
    done_at: datetime | None


class SetOut(BaseModel):
    id: uuid.UUID
    n: int
    target: SetTargetOut
    previous: SetPreviousOut | None
    logged: SetLoggedOut | None


class SubstituteOut(BaseModel):
    exercise_id: str
    name_it: str
    why_it: str


class NameOut(BaseModel):
    name_it: str


class ChangedTodayOut(BaseModel):
    label_it: str


class SessionExerciseOut(BaseModel):
    id: uuid.UUID
    exercise_id: str
    name_it: str
    pattern: str
    order: int
    media: MediaOut
    prescription: PrescriptionOut
    substituted_from: NameOut | None = None
    changed_today: ChangedTodayOut | None = None
    removed_today: bool = False
    removed_reason_it: str | None = None
    skipped: bool = False
    substitutes: list[SubstituteOut] = Field(max_length=5)
    instructions_it: list[str]
    sets: list[SetOut]
    notes: list[Note] = Field(description="Sottoinsieme di `notes` della seduta: stessi numeri")


class SessionOut(BaseModel):
    """design-system §9.5. I numeri delle note sono locali alla seduta."""

    id: uuid.UUID
    name: str
    date: date
    week: int
    index_in_week: int
    sessions_in_week: int
    status: Literal["planned", "done", "short", "skipped"]
    short_version: bool
    est_minutes: int
    updated_at: datetime
    readiness_done: bool
    exercises: list[SessionExerciseOut]
    notes: list[Note]
    close_line: str | None = None


class ReadinessIn(BaseModel):
    sleep: Literal["lt6", "6to8", "gt8"]
    mood: Literal["low", "mid", "high"]
    pain: Literal["none", "mild", "severe"]


class RemovedExerciseOut(BaseModel):
    exercise_id: str
    name: str
    reason_it: str
    note_n: int | None


class ChangedSetOut(BaseModel):
    set_id: uuid.UUID | None = Field(default=None, description="null: la modifica vale per tutte le serie dell'esercizio")
    exercise_id: str
    field: Literal["sets", "reps", "weight", "rest", "rir"]
    from_value: float | int | None = Field(alias="from")
    to_value: float | int | None = Field(alias="to")

    model_config = {"populate_by_name": True}


class ReadinessDiffOut(BaseModel):
    removed_exercises: list[RemovedExerciseOut]
    changed_sets: list[ChangedSetOut]
    short_version: bool
    est_minutes: int


class SafetyOptionOut(BaseModel):
    id: str
    label: str


class SafetyOut(BaseModel):
    text: str
    options: list[SafetyOptionOut]
    message_id: uuid.UUID = Field(description="v1.1: il messaggio `kind:safety` creato in chat; le opzioni si eseguono con POST /chat/options/{id} { message_id }")


class ReadinessOut(BaseModel):
    session: SessionOut
    diff: ReadinessDiffOut
    coach_line: str
    notes: list[Note]
    safety: SafetyOut | None = None


class ClientOp(BaseModel):
    client_op_id: str = Field(min_length=1, max_length=64)
    client_updated_at: datetime = Field(description="Ora del client; può essere ore nel passato (palestra senza rete)")


class SetPatchIn(ClientOp):
    weight_kg: float | None = Field(default=None, ge=0, le=1000)
    reps: int | None = Field(default=None, ge=0, le=100)
    rir: int | None = Field(default=None, ge=0, le=10)
    status: Literal["todo", "done", "skipped"] | None = None


class SetAddIn(ClientOp):
    exercise_id: uuid.UUID = Field(description="id dell'esercizio nella seduta (non lo slug)")


class SubstituteIn(ClientOp):
    exercise_id: str = Field(description="slug del nuovo esercizio (da `substitutes`)")


class CloseSetIn(BaseModel):
    set_id: uuid.UUID
    weight_kg: float | None = Field(default=None, ge=0, le=1000)
    reps: int | None = Field(default=None, ge=0, le=100)
    rir: int | None = Field(default=None, ge=0, le=10)
    status: Literal["todo", "done", "skipped"] = "done"


class CloseIn(ClientOp):
    sets: list[CloseSetIn] = Field(default_factory=list, description="La bozza intera: merge per set")


class CloseOut(BaseModel):
    close_line: str
    notes: list[Note]
    session: SessionOut


class SyncOpIn(BaseModel):
    op: Literal["patch_set", "add_set", "delete_set", "substitute", "skip", "restore", "close"]
    client_op_id: str = Field(min_length=1, max_length=64)
    client_updated_at: datetime
    set_id: uuid.UUID | None = None
    exercise_id: uuid.UUID | None = Field(default=None, description="id dell'esercizio nella seduta")
    new_exercise_id: str | None = Field(default=None, description="slug, per substitute")
    weight_kg: float | None = Field(default=None, ge=0, le=1000)
    reps: int | None = Field(default=None, ge=0, le=100)
    rir: int | None = Field(default=None, ge=0, le=10)
    status: Literal["todo", "done", "skipped"] | None = None
    sets: list[CloseSetIn] | None = None


class SyncIn(BaseModel):
    ops: list[SyncOpIn] = Field(max_length=500)


class SyncResultOut(BaseModel):
    client_op_id: str
    status: Literal["applied", "duplicate", "error"]
    code: str | None = None
    detail: str | None = None


class SyncOut(BaseModel):
    results: list[SyncResultOut]
    session: SessionOut


# ---------------------------------------------------------------- piano


class WeekChangeOut(BaseModel):
    text: str
    note_n: int | None


class WeekSessionOut(BaseModel):
    session_id: uuid.UUID
    day: Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    date: date
    name: str
    exercises_count: int
    sets_count: int
    est_minutes: int
    status: Literal["done", "skipped", "short", "today", "planned", "none"]


class WeekOut(BaseModel):
    n: int
    label_it: str
    is_current: bool
    is_deload: bool
    is_maintenance: bool
    changes_it: list[WeekChangeOut]
    sessions: list[WeekSessionOut]


class PlanMesocycleOut(BaseModel):
    index: int
    status: Literal["active", "maintenance", "completed"]
    total_weeks: int
    editable: bool
    split: Literal["full_body", "upper_lower", "ppl"]
    started_on: date
    maintenance_note_it: str | None = None


class PlanOut(BaseModel):
    mesocycle: PlanMesocycleOut
    weeks: list[WeekOut]
    notes: list[Note]


class MesocycleCreatedOut(BaseModel):
    mesocycle: MesocycleBriefOut
    first_session_id: uuid.UUID
    coach_comment_message_id: uuid.UUID | None


class ProposalPatchIn(BaseModel):
    """Il patch che il coach (o l'utente da Settimana) propone. Il motore valida."""

    op: Literal["adjust_sets", "substitute", "move_session"]
    session_id: uuid.UUID | None = None
    exercise_id: uuid.UUID | None = Field(default=None, description="id dell'esercizio nella seduta")
    exercise_query: str | None = Field(default=None, max_length=200, description="nome libero, se il coach non ha l'id")
    delta: int | None = Field(default=None, ge=-2, le=2)
    new_exercise_id: str | None = None
    new_day_offset: int | None = Field(default=None, ge=-6, le=6)
    scope: Literal["session", "rest_of_block"] = "rest_of_block"


class ProposalIn(BaseModel):
    patch: ProposalPatchIn


class ProposalDiffOut(BaseModel):
    exercise: str
    field: str
    from_value: str | int | float | None = Field(alias="from")
    to_value: str | int | float | None = Field(alias="to")
    note_n: int | None

    model_config = {"populate_by_name": True}


class ProposalOut(BaseModel):
    proposal_id: uuid.UUID
    status: Literal["proposed", "accepted", "rejected", "invalid"]
    diff: list[ProposalDiffOut]
    notes: list[Note]
    valid: bool
    invalid_reason_it: str | None = None


# ---------------------------------------------------------------- oggi


class SessionPreviewOut(BaseModel):
    session_id: uuid.UUID
    name: str
    exercises_count: int
    est_minutes: int
    short_available: bool = Field(description="v1.1: true se la seduta è aperta e non è già in versione corta (POST /sessions/{id}/short)")
    status: Literal["planned", "done", "short", "skipped"]


class TodayOptionAction(BaseModel):
    type: Literal["route", "chat_option"]
    target: str = Field(description="route: il percorso; chat_option: l'option_id da passare a POST /chat/options/{option_id}")
    message_id: uuid.UUID | None = Field(default=None, description="v1.1: per chat_option, il message_id del messaggio del coach che porta l'opzione (lo stesso di `redirect`)")


class TodayOptionOut(BaseModel):
    id: str
    label: str
    description: str | None = None
    is_pro: bool = False
    action: TodayOptionAction


class EmptyStateOut(BaseModel):
    title: str
    coach_text: str
    notes: list[Note]
    options: list[TodayOptionOut]


class TodayOut(BaseModel):
    """design-system §9.3."""

    kind: Literal["session", "rest_day", "session_skipped", "week_skipped", "return_after_break", "maintenance", "block_completed"]
    date: date
    session_preview: SessionPreviewOut | None = None
    empty_state: EmptyStateOut | None = None
    readiness_required: bool
    redirect: str | None = None


# ---------------------------------------------------------------- progressi


class ConsistencyDayOut(BaseModel):
    date: date
    status: Literal["done", "short", "return", "skipped", "rest", "future", "none"]
    session_id: uuid.UUID | None = None


class ConsistencyOut(BaseModel):
    done: int
    planned: int
    returns: int
    days: list[ConsistencyDayOut]
    caption_it: str
    note: Note
    window_limited_by_plan: bool


class PrOut(BaseModel):
    weight_kg: float
    reps: int
    date: date


class ProgressExerciseOut(BaseModel):
    exercise_id: str
    name_it: str
    last_weight_kg: float | None
    pr: PrOut | None


class ProgressPointOut(BaseModel):
    date: date
    week: int
    best_weight_kg: float | None
    reps: int
    is_pr: bool


class ProgressHistoryOut(BaseModel):
    exercise_id: str
    name_it: str
    points: list[ProgressPointOut]
    history_limited: bool
    since: date


# ---------------------------------------------------------------- riepilogo


class HighlightOut(BaseModel):
    label_it: str
    from_value: float | int | None = Field(alias="from")
    to_value: float | int | None = Field(alias="to")
    unit: str | None
    kind: Literal["count", "weight", "reps"]

    model_config = {"populate_by_name": True}


class SummaryOut(BaseModel):
    block_index: int
    sessions_done: int
    sessions_planned: int
    highlights: list[HighlightOut] = Field(max_length=3)
    coach_paragraph: str
    notes: list[Note]
    next_block_preview_it: str
    is_pro: bool
    paywall_context_line: str
