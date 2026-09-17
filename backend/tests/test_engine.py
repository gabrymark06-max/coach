"""Seam: il motore di programmazione puro (app.engine). Nessun DB, nessun LLM."""

from datetime import date

import pytest

from app.engine import (
    ProfileInput,
    ReadinessInput,
    adapt_for_readiness,
    generate_mesocycle,
    load_catalog,
    load_rules,
    maintenance_week,
    next_targets,
    short_version,
)
from app.engine.models import LoggedSet, Prescription

RULES = load_rules()
CATALOG = load_catalog()
START = date(2026, 9, 16)


def profile(**over):
    base = dict(
        goal="hypertrophy",
        level="beginner",
        days_per_week=3,
        minutes_per_session=60,
        location="gym",
        equipment=[],
        avoid_patterns=[],
        conservative=False,
    )
    base.update(over)
    return ProfileInput(**base)


# ---------------------------------------------------------------- generazione


def test_beginner_3_days_gets_full_body_4_weeks_with_deload_last():
    plan = generate_mesocycle(profile(), RULES, CATALOG, start=START, index=1)
    assert plan.split == "full_body"
    assert plan.tier == "beginner"
    assert plan.total_weeks == 4
    assert [w.is_deload for w in plan.weeks] == [False, False, False, True]
    assert all(len(w.sessions) == 3 for w in plan.weeks)
    assert plan.rule_ids >= {"split.by_days.full_body", "block.length_weeks", "deload.volume_and_load"}


@pytest.mark.parametrize("days,split", [(2, "full_body"), (4, "upper_lower"), (5, "ppl"), (6, "ppl")])
def test_split_follows_days_rule(days, split):
    plan = generate_mesocycle(profile(level="intermediate", days_per_week=days), RULES, CATALOG, start=START, index=1)
    assert plan.split == split
    assert all(len(w.sessions) == days for w in plan.weeks)


def test_every_parameter_carries_an_existing_rule_id():
    plan = generate_mesocycle(profile(), RULES, CATALOG, start=START, index=1)
    for w in plan.weeks:
        for s in w.sessions:
            assert s.exercises, "seduta vuota"
            for ex in s.exercises:
                for field in ("sets", "reps", "rest", "rir", "selection"):
                    rid = ex.rule_refs[field]
                    assert rid in RULES, f"{field} -> {rid} non esiste nelle regole"


def test_beginner_week1_has_rir_plus_one_and_no_prescribed_weight():
    plan = generate_mesocycle(profile(), RULES, CATALOG, start=START, index=1)
    w1 = plan.weeks[0].sessions[0].exercises[0]
    w2 = plan.weeks[1].sessions[0].exercises[0]
    assert w1.rir_target == 4 and w2.rir_target == 3  # regola rir.target.beginner=3 + rir.week1.plus_one
    assert all(st.target_weight_kg is None for st in w1.set_targets)
    assert w1.reps == (8, 12)


def test_deload_halves_sets_and_adds_rir():
    plan = generate_mesocycle(profile(level="intermediate", days_per_week=4), RULES, CATALOG, start=START, index=1)
    w3 = plan.weeks[2].sessions[0].exercises[0]
    w4 = plan.weeks[3].sessions[0].exercises[0]
    assert w4.sets == max(2, round(w3.sets * 0.5))
    assert w4.rir_target == w3.rir_target + 2
    assert w4.rule_refs["sets"] == "deload.volume_and_load"


def test_intermediate_week3_adds_one_set_on_compounds():
    plan = generate_mesocycle(profile(level="intermediate", days_per_week=4), RULES, CATALOG, start=START, index=1)
    w2 = plan.weeks[1].sessions[0].exercises[0]
    w3 = plan.weeks[2].sessions[0].exercises[0]
    assert w2.mechanic == "compound"
    assert w3.sets == min(5, w2.sets + 1)
    assert w3.rule_refs["sets"] == "volume.week3.add_set"


def test_home_dumbbells_never_selects_barbell_or_machine():
    plan = generate_mesocycle(profile(location="home_dumbbells"), RULES, CATALOG, start=START, index=1)
    used = {ex.equipment for w in plan.weeks for s in w.sessions for ex in s.exercises}
    assert used <= {"dumbbell", "bodyweight"}


def test_bodyweight_only_selects_bodyweight_and_band_if_available():
    plan = generate_mesocycle(profile(location="bodyweight", equipment=["band"]), RULES, CATALOG, start=START, index=1)
    used = {ex.equipment for w in plan.weeks for s in w.sessions for ex in s.exercises}
    assert used <= {"bodyweight", "band"}


def test_health_tier_is_conservative():
    plan = generate_mesocycle(profile(goal="health", level="beginner"), RULES, CATALOG, start=START, index=1)
    assert plan.tier == "health"
    ex = plan.weeks[1].sessions[0].exercises[0]
    assert ex.rir_target == 4
    assert ex.reps == (10, 15)
    assert all(e.spinal_load == "low" for w in plan.weeks for s in w.sessions for e in s.exercises)


def test_strength_goal_uses_low_reps_and_long_rest():
    plan = generate_mesocycle(profile(goal="strength", level="intermediate", days_per_week=4), RULES, CATALOG, start=START, index=1)
    ex = plan.weeks[1].sessions[0].exercises[0]
    assert ex.reps == (4, 6)
    assert ex.rest_s == 180
    assert ex.rule_refs["rest"] == "rest.compound.strength"


def test_avoid_patterns_are_respected():
    plan = generate_mesocycle(profile(avoid_patterns=["hinge"]), RULES, CATALOG, start=START, index=1)
    assert all(ex.pattern != "hinge" for w in plan.weeks for s in w.sessions for ex in s.exercises)


def test_session_dates_start_today_and_week_lengths_are_7_days():
    plan = generate_mesocycle(profile(days_per_week=3), RULES, CATALOG, start=START, index=1)
    assert plan.weeks[0].sessions[0].date == START
    assert plan.weeks[1].starts_on == START.replace(day=23)
    assert plan.weeks[0].sessions[-1].date < plan.weeks[1].sessions[0].date


def test_est_minutes_fits_the_requested_time():
    plan = generate_mesocycle(profile(minutes_per_session=45), RULES, CATALOG, start=START, index=1)
    for w in plan.weeks:
        for s in w.sessions:
            assert 15 <= s.est_minutes <= 60


def test_changing_a_rule_changes_the_plan_where_expected():
    """Brief §8 rischio 9: se cambio una regola, i piani cambiano dove atteso."""
    rules = load_rules()
    rules["rir.target.beginner"].value["rir"] = 1
    plan = generate_mesocycle(profile(), rules, CATALOG, start=START, index=1)
    assert plan.weeks[1].sessions[0].exercises[0].rir_target == 1


# ---------------------------------------------------------------- progressione doppia


def _presc(**over):
    base = dict(
        exercise_id="back_squat", equipment="barbell", pattern="squat", sets=3, reps=(8, 12), rir_target=2, rest_s=120
    )
    base.update(over)
    return Prescription(**base)


def test_progress_adds_weight_when_all_sets_hit_top_reps_at_target_rir():
    logged = [LoggedSet(weight_kg=60, reps=12, rir=2) for _ in range(3)]
    t = next_targets(_presc(), logged, RULES)
    assert t.weight_kg == 65  # barbell_lower +5
    assert t.reps == 8  # riparte dal fondo del range
    assert t.rule_id == "progression.double.reps_then_load"


def test_progress_adds_reps_when_below_top():
    logged = [LoggedSet(weight_kg=60, reps=10, rir=2), LoggedSet(weight_kg=60, reps=9, rir=3), LoggedSet(60, 9, 3)]
    t = next_targets(_presc(), logged, RULES)
    assert t.weight_kg == 60
    assert t.reps == 10  # il minimo delle serie loggate +1


def test_progress_reduces_load_when_too_hard():
    logged = [LoggedSet(weight_kg=60, reps=8, rir=0), LoggedSet(60, 7, 0), LoggedSet(60, 6, 0)]
    t = next_targets(_presc(), logged, RULES)
    assert t.weight_kg == 57  # -5% arrotondato a 0.5 -> 57.0
    assert t.rule_id == "progression.reduce_when_too_hard"


def test_progress_upper_barbell_increment_is_2_5():
    logged = [LoggedSet(weight_kg=40, reps=12, rir=2) for _ in range(3)]
    t = next_targets(_presc(exercise_id="bench_press", pattern="push_h"), logged, RULES)
    assert t.weight_kg == 42.5


def test_progress_bodyweight_moves_reps():
    logged = [LoggedSet(weight_kg=None, reps=12, rir=2) for _ in range(3)]
    t = next_targets(_presc(exercise_id="push_up", equipment="bodyweight", pattern="push_h"), logged, RULES)
    assert t.weight_kg is None and t.reps == 14


def test_progress_without_logs_keeps_targets():
    t = next_targets(_presc(), [], RULES, previous_weight=50.0)
    assert t.weight_kg == 50.0 and t.reps == 8 and t.rule_id is None


# ---------------------------------------------------------------- versione corta, mantenimento, readiness


def test_short_version_is_about_25_minutes():
    plan = generate_mesocycle(profile(level="intermediate", days_per_week=4), RULES, CATALOG, start=START, index=1)
    s = plan.weeks[1].sessions[0]
    short = short_version(s, RULES)
    assert len([e for e in short.exercises if not e.removed_today]) <= 4
    assert all(e.sets == 2 for e in short.exercises if not e.removed_today)
    assert short.est_minutes <= 30
    assert short.short_version is True


def test_maintenance_week_repeats_last_training_week():
    plan = generate_mesocycle(profile(), RULES, CATALOG, start=START, index=1)
    m = maintenance_week(plan, n=5)
    src = plan.weeks[2]  # ultima settimana non-deload
    assert m.is_maintenance and not m.is_deload
    assert [e.exercise_id for e in m.sessions[0].exercises] == [e.exercise_id for e in src.sessions[0].exercises]
    assert [e.sets for e in m.sessions[0].exercises] == [e.sets for e in src.sessions[0].exercises]
    assert m.starts_on == plan.weeks[3].starts_on.replace(day=plan.weeks[3].starts_on.day + 7)


def test_readiness_low_sleep_gives_short_version():
    plan = generate_mesocycle(profile(), RULES, CATALOG, start=START, index=1)
    s = plan.weeks[1].sessions[0]
    out = adapt_for_readiness(s, ReadinessInput(sleep="lt6", mood="mid", pain="none"), RULES)
    assert out.diff.short_version is True
    assert out.safety is None
    assert "readiness.low.short_version" in out.rule_ids
    assert out.diff.est_minutes <= 30


def test_readiness_mild_pain_removes_high_spinal_load_and_adds_rir():
    plan = generate_mesocycle(profile(level="intermediate", days_per_week=4), RULES, CATALOG, start=START, index=1)
    lower = next(s for s in plan.weeks[1].sessions if any(e.pattern == "hinge" for e in s.exercises))
    assert any(e.spinal_load == "high" for e in lower.exercises)
    out = adapt_for_readiness(lower, ReadinessInput(sleep="6to8", mood="high", pain="mild"), RULES)
    removed = [e for e in out.session.exercises if e.removed_today]
    assert removed and all(e.spinal_load == "high" for e in removed)
    assert all(e.removed_rule_id == "readiness.pain.mild" for e in removed)
    kept = [e for e in out.session.exercises if not e.removed_today]
    assert all(e.rir_target == lower.exercises[[x.exercise_id for x in lower.exercises].index(e.exercise_id)].rir_target + 1 for e in kept)
    assert out.diff.removed_exercises[0].exercise_id == removed[0].exercise_id


def test_readiness_severe_pain_is_a_safety_block_without_changes():
    plan = generate_mesocycle(profile(), RULES, CATALOG, start=START, index=1)
    s = plan.weeks[1].sessions[0]
    out = adapt_for_readiness(s, ReadinessInput(sleep="gt8", mood="high", pain="severe"), RULES)
    assert out.safety is not None
    assert [o.id for o in out.safety.options] == ["pause_plan", "remove_exercise", "continue_anyway"]
    assert not out.diff.removed_exercises and not out.diff.changed_sets
