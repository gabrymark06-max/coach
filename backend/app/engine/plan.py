"""Generazione del mesociclo. Puro: (profilo, regole, catalogo, data) -> piano con rule_id su ogni numero."""

from __future__ import annotations

from datetime import date, timedelta

from app.engine.models import (
    ExerciseSpec,
    MesoPlan,
    PlannedExerciseSpec,
    ProfileInput,
    Rule,
    SessionSpec,
    WeekSpec,
    clone_session,
)

# ---------------------------------------------------------------- template degli split

TEMPLATES: dict[str, list[tuple[str, str, list[str]]]] = {
    # (template_key, nome, pattern in ordine: prima i multiarticolari — order.compound_first)
    "full_body": [
        ("full_a", "Full Body A", ["squat", "push_h", "pull_h", "hinge", "core"]),
        ("full_b", "Full Body B", ["hinge", "push_v", "pull_v", "lunge", "core"]),
        ("full_c", "Full Body C", ["squat", "push_h", "pull_h", "delt_side", "curl"]),
    ],
    "upper_lower": [
        ("upper_1", "Parte alta 1", ["push_h", "pull_h", "push_v", "pull_v", "curl", "triceps"]),
        ("lower_1", "Parte bassa 1", ["squat", "hinge", "lunge", "ham_iso", "calf", "core"]),
        ("upper_2", "Parte alta 2", ["push_h", "pull_v", "delt_side", "delt_rear", "curl", "triceps"]),
        ("lower_2", "Parte bassa 2", ["hinge", "squat", "glute", "quad_iso", "calf", "core"]),
    ],
    "ppl": [
        ("push", "Spinta", ["push_h", "push_v", "chest_iso", "delt_side", "triceps"]),
        ("pull", "Tirata", ["pull_v", "pull_h", "delt_rear", "curl", "core"]),
        ("legs", "Gambe", ["squat", "hinge", "lunge", "ham_iso", "calf"]),
    ],
}

DAY_OFFSETS: dict[int, list[int]] = {2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5]}

# Se uno schema non è disponibile con l'attrezzatura che c'è, si ripiega su questo (o si salta lo slot).
FALLBACK_PATTERN: dict[str, str | None] = {
    "pull_v": "pull_h",
    "push_v": "push_h",
    "hinge": "glute",
    "squat": "lunge",
    "lunge": "squat",
    "ham_iso": "hinge",
    "quad_iso": "lunge",
    "chest_iso": "push_h",
    "delt_side": "push_v",
    "delt_rear": "pull_h",
    "glute": "hinge",
    "curl": None,
    "triceps": None,
    "calf": None,
    "core": None,
}

TIER_RANK = {"beginner": 0, "health": 0, "intermediate": 1}

EQUIPMENT_PREFERENCE: dict[str, list[str]] = {
    "beginner": ["machine", "dumbbell", "bodyweight", "cable", "barbell", "band"],
    "health": ["machine", "dumbbell", "bodyweight", "cable", "band", "barbell"],
    "intermediate": ["barbell", "dumbbell", "cable", "machine", "bodyweight", "band"],
}

SELECTION_RULE = {
    "beginner": "selection.beginner.simple_first",
    "intermediate": "selection.intermediate.free_weights_first",
    "health": "selection.health.low_spinal_load",
}


def available_equipment(profile: ProfileInput) -> set[str]:
    base = {
        "gym": {"barbell", "dumbbell", "machine", "cable", "bodyweight"},
        "home_dumbbells": {"dumbbell", "bodyweight"},
        "bodyweight": {"bodyweight"},
    }[profile.location]
    if "band" in profile.equipment:
        base.add("band")
    return base


def _split_for(days: int, rules: dict[str, Rule]) -> tuple[str, str]:
    for rid in ("split.by_days.full_body", "split.by_days.upper_lower", "split.by_days.ppl"):
        r = rules[rid]
        if days in r.applies_to.get("days_per_week", []):
            return r.value["split"], rid
    raise ValueError(f"nessuna regola di split per {days} giorni")


def candidates(
    catalog: list[ExerciseSpec],
    pattern: str,
    profile: ProfileInput,
    *,
    exclude: set[str] = frozenset(),
    prefer_unused: set[str] = frozenset(),
) -> list[ExerciseSpec]:
    """Esercizi ammessi per uno schema, ordinati per preferenza del livello."""
    avail = available_equipment(profile)
    tier = profile.tier
    low_only = tier == "health" or profile.conservative
    pref = EQUIPMENT_PREFERENCE[tier]
    out = [
        e
        for e in catalog
        if e.pattern == pattern
        and e.equipment in avail
        and TIER_RANK[e.min_tier] <= TIER_RANK[tier]
        and (not low_only or e.spinal_load == "low")
        and (e.requires is None or e.requires in profile.equipment)
        and e.id not in exclude
        and e.pattern not in profile.avoid_patterns
    ]
    out.sort(key=lambda e: (e.id in prefer_unused, pref.index(e.equipment)))
    return out


def select_exercise(
    catalog: list[ExerciseSpec], pattern: str, profile: ProfileInput, *, used_in_week: set[str], in_session: set[str]
) -> ExerciseSpec | None:
    cands = candidates(catalog, pattern, profile, exclude=in_session, prefer_unused=used_in_week)
    return cands[0] if cands else None


def substitutes_for(
    catalog: list[ExerciseSpec], exercise: ExerciseSpec, profile: ProfileInput, *, limit: int = 5
) -> list[ExerciseSpec]:
    """selection.substitute.same_pattern: stesso schema, attrezzatura disponibile."""
    return candidates(catalog, exercise.pattern, profile, exclude={exercise.id})[:limit]


# ---------------------------------------------------------------- parametri


def _reps_rule(profile: ProfileInput, rules: dict[str, Rule]) -> Rule:
    if profile.goal == "strength" and profile.tier == "beginner":
        return rules["reps.range.strength.beginner"]
    return rules[f"reps.range.{profile.goal}"]


def _rest_rule(mechanic: str, goal: str, rules: dict[str, Rule]) -> Rule:
    if mechanic == "compound" and goal == "strength":
        return rules["rest.compound.strength"]
    return rules["rest.compound"] if mechanic == "compound" else rules["rest.isolation"]


def _sets_bounds(tier: str, rules: dict[str, Rule]) -> tuple[int, int]:
    v = rules["volume.sets_per_exercise.bounds"].value
    hi = v["max"]
    if tier == "beginner":
        hi = v.get("max_beginner", hi)
    if tier == "health":
        hi = v.get("max_health", hi)
    return v["min"], hi


def estimate_minutes(session: SessionSpec, rules: dict[str, Rule]) -> int:
    v = rules["session.duration_estimate"].value
    total_s = sum(e.sets * (e.rest_s + v["seconds_per_set_work"]) for e in session.active_exercises())
    return int(round(v["warmup_minutes"] + total_s / 60))


# ---------------------------------------------------------------- generazione


def generate_mesocycle(
    profile: ProfileInput,
    rules: dict[str, Rule],
    catalog: list[ExerciseSpec],
    *,
    start: date,
    index: int,
) -> MesoPlan:
    tier = profile.tier
    used_rules: set[str] = set()
    split, split_rule = _split_for(profile.days_per_week, rules)
    used_rules.add(split_rule)

    block = rules["block.length_weeks"]
    total_weeks = int(block.value["weeks"])
    deload_week = int(block.value["deload_week"])
    used_rules.add(block.id)

    templates = TEMPLATES[split]
    n_sessions = profile.days_per_week
    week_templates = [templates[i % len(templates)] for i in range(n_sessions)]

    # 1) selezione degli esercizi della settimana tipo (uguale in tutte le settimane del blocco)
    used_in_week: set[str] = set()
    base_sessions: list[tuple[str, str, list[ExerciseSpec]]] = []
    for key, name, patterns in week_templates:
        chosen: list[ExerciseSpec] = []
        in_session: set[str] = set()
        for pat in patterns:
            p = pat
            ex = None
            while p is not None:
                ex = select_exercise(catalog, p, profile, used_in_week=used_in_week, in_session=in_session)
                if ex is not None:
                    break
                p = FALLBACK_PATTERN.get(p)
            if ex is None:
                continue
            chosen.append(ex)
            in_session.add(ex.id)
            used_in_week.add(ex.id)
        base_sessions.append((key, name, chosen))

    # 2) serie per esercizio dal volume settimanale: target / frequenza del muscolo primario
    vol_rule = rules[f"volume.weekly_sets.{tier}"]
    used_rules.add(vol_rule.id)
    bounds_rule = rules["volume.sets_per_exercise.bounds"]
    used_rules.add(bounds_rule.id)
    lo, hi = _sets_bounds(tier, rules)
    muscle_freq: dict[str, int] = {}
    for _, _, chosen in base_sessions:
        for m in {e.primary_muscle for e in chosen}:
            muscle_freq[m] = muscle_freq.get(m, 0) + 1

    def base_sets(e: ExerciseSpec) -> int:
        freq = max(1, muscle_freq.get(e.primary_muscle, 1))
        return max(lo, min(hi, round(vol_rule.value["sets"] / freq)))

    reps_rule = _reps_rule(profile, rules)
    rir_rule = rules[f"rir.target.{tier}"]
    week1_rule = rules["rir.week1.plus_one"]
    deload_rule = rules["deload.volume_and_load"]
    week3_rule = rules.get("volume.week3.add_set")
    find_load_rule = rules["progression.week1.find_load"]
    order_rule = rules["order.compound_first"]
    duration_rule = rules["session.duration_estimate"]
    used_rules.update({reps_rule.id, rir_rule.id, week1_rule.id, deload_rule.id, find_load_rule.id, order_rule.id, duration_rule.id, SELECTION_RULE[tier]})

    weeks: list[WeekSpec] = []
    for n in range(1, total_weeks + 1):
        is_deload = n == deload_week
        starts_on = start + timedelta(days=7 * (n - 1))
        changes: list[dict] = []
        add_set = week3_rule is not None and tier in (week3_rule.applies_to.get("tier"),) and n == week3_rule.value["week"]
        if n == 1:
            changes = [
                {"text": "Trovi il carico: nessun peso prescritto, segna quello che usi[[rule:progression.week1.find_load]]", "rule_id": find_load_rule.id},
                {"text": "Una ripetizione in riserva in più[[rule:rir.week1.plus_one]]", "rule_id": week1_rule.id},
            ]
        if add_set:
            changes.append({"text": "Una serie in più sugli esercizi principali[[rule:volume.week3.add_set]]", "rule_id": week3_rule.id})
            used_rules.add(week3_rule.id)
        if is_deload:
            changes.append({"text": "Deload: metà serie, carico più leggero, due ripetizioni in riserva in più[[rule:deload.volume_and_load]]", "rule_id": deload_rule.id})
        label = f"Settimana {n}"
        if is_deload:
            label += " · deload"
        elif add_set:
            label += " · +1 serie"

        sessions: list[SessionSpec] = []
        offsets = DAY_OFFSETS[n_sessions]
        for i, (key, name, chosen) in enumerate(base_sessions):
            exercises: list[PlannedExerciseSpec] = []
            for order, e in enumerate(chosen):
                sets = base_sets(e)
                sets_rule = vol_rule.id
                rir = int(rir_rule.value["rir"])
                rir_ref = rir_rule.id
                if n == 1:
                    rir += int(week1_rule.value["delta"])
                    rir_ref = week1_rule.id
                if add_set and e.mechanic == "compound":
                    sets = min(hi if tier != "beginner" else 5, sets + int(week3_rule.value["delta"]))
                    sets_rule = week3_rule.id
                if is_deload:
                    sets = max(2, round(sets * float(deload_rule.value["sets_factor"])))
                    rir += int(deload_rule.value["rir_delta"])
                    sets_rule = deload_rule.id
                    rir_ref = deload_rule.id
                rest_rule = _rest_rule(e.mechanic, profile.goal, rules)
                used_rules.add(rest_rule.id)
                pe = PlannedExerciseSpec(
                    exercise_id=e.id,
                    name_it=e.name_it,
                    pattern=e.pattern,
                    primary_muscle=e.primary_muscle,
                    equipment=e.equipment,
                    mechanic=e.mechanic,
                    spinal_load=e.spinal_load,
                    order=order,
                    sets=sets,
                    reps=(int(reps_rule.value["min"]), int(reps_rule.value["max"])),
                    rest_s=int(rest_rule.value["seconds"]),
                    rir_target=rir,
                    rule_refs={
                        "sets": sets_rule,
                        "reps": reps_rule.id,
                        "rest": rest_rule.id,
                        "rir": rir_ref,
                        "selection": SELECTION_RULE[tier],
                        "weight": find_load_rule.id if n == 1 else "progression.double.reps_then_load",
                    },
                )
                pe.rebuild_sets(weight=None)
                exercises.append(pe)
            s = SessionSpec(
                template_key=key,
                name=name,
                index_in_week=i,
                sessions_in_week=n_sessions,
                date=starts_on + timedelta(days=offsets[i]),
                exercises=exercises,
                rule_ids=[order_rule.id, duration_rule.id],
            )
            _fit_to_minutes(s, profile.minutes_per_session, rules)
            s.est_minutes = estimate_minutes(s, rules)
            sessions.append(s)
        weeks.append(
            WeekSpec(n=n, is_deload=is_deload, is_maintenance=False, label_it=label, starts_on=starts_on, changes=changes, sessions=sessions)
        )
    used_rules.add("progression.double.reps_then_load")
    return MesoPlan(index=index, split=split, tier=tier, total_weeks=total_weeks, started_on=start, weeks=weeks, rule_ids=used_rules)


def _fit_to_minutes(session: SessionSpec, minutes: int, rules: dict[str, Rule]) -> None:
    """Se la seduta non sta nel tempo dichiarato, togliamo gli ultimi esercizi (isolamento) fino a 3."""
    while estimate_minutes(session, rules) > minutes and len(session.exercises) > 3:
        session.exercises.pop()


# ---------------------------------------------------------------- mantenimento e versione corta


def maintenance_week(plan: MesoPlan, *, n: int) -> WeekSpec:
    """maintenance.repeat_week: ripete l'ultima settimana di allenamento (non il deload), identica."""
    training_weeks = [w for w in plan.weeks if not w.is_deload and not w.is_maintenance]
    src = training_weeks[-1]
    starts_on = plan.started_on + timedelta(days=7 * (n - 1))
    sessions = []
    for s in src.sessions:
        c = clone_session(s)
        c.date = starts_on + (s.date - src.starts_on)
        c.short_version = False
        for e in c.exercises:
            e.removed_today = False
            e.removed_reason_it = None
            e.removed_rule_id = None
            e.changed_today_label_it = None
        sessions.append(c)
    return WeekSpec(
        n=n,
        is_deload=False,
        is_maintenance=True,
        label_it="Settimana che si ripete",
        starts_on=starts_on,
        changes=[{"text": "In mantenimento la settimana si ripete uguale[[rule:maintenance.repeat_week]]", "rule_id": "maintenance.repeat_week"}],
        sessions=sessions,
    )


def short_version(session: SessionSpec, rules: dict[str, Rule]) -> SessionSpec:
    """session.short_version: primi N esercizi, 2 serie, riposo ridotto. Stessi carichi."""
    r = rules["session.short_version"]
    out = clone_session(session)
    kept = 0
    for e in out.exercises:
        if e.removed_today:
            continue
        if kept >= int(r.value["max_exercises"]):
            e.removed_today = True
            e.removed_reason_it = "Versione corta: oggi lo saltiamo"
            e.removed_rule_id = r.id
            continue
        kept += 1
        if e.sets != int(r.value["sets"]):
            e.changed_today_label_it = f"{int(r.value['sets'])} serie invece di {e.sets}"
            e.sets = int(r.value["sets"])
            e.rule_refs["sets"] = r.id
            e.rebuild_sets()
        if e.rest_s > int(r.value["rest_seconds"]):
            e.rest_s = int(r.value["rest_seconds"])
            e.rule_refs["rest"] = r.id
    out.short_version = True
    if r.id not in out.rule_ids:
        out.rule_ids.append(r.id)
    out.est_minutes = estimate_minutes(out, rules)
    return out
