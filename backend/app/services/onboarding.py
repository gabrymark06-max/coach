"""Onboarding: schema (contenuto, non codice), invio, consenso art. 9, gate di sicurezza proprio."""

from __future__ import annotations

import re
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clock import today_local
from app.config import Settings
from app.engine import generate_mesocycle
from app.errors import ApiError, Conflict, UnprocessableError
from app.llm.base import LLMProvider
from app.models import Mesocycle, PlannedSession, Profile, User
from app.schemas.plans import (
    ConsentOut,
    FieldOut,
    GateOut,
    GateQuestionOut,
    HealthConsentOut,
    MesocycleBriefOut,
    OnboardingIn,
    OnboardingOut,
    OnboardingSchemaOut,
    OptionOut,
    StepOut,
)
from app.services import coach, events
from app.services import plans as plans_service
from app.services.notes import KnowledgeIndex, note_for_rule

DISCLAIMER_IT = (
    "fitcoach non è un servizio medico e non sostituisce il parere di un medico, di un fisioterapista o di un "
    "professionista del movimento. Le schede sono generate da regole scritte da persone, con lo studio accanto; "
    "il coach che ti scrive è un'intelligenza artificiale. Se hai una condizione di salute, parla con il tuo "
    "medico prima di iniziare."
)

# Questionario di screening proprio: NON è il PAR-Q+ (licenza), non ne copia il testo e non si chiama così.
GATE_QUESTIONS: list[tuple[str, str, bool]] = [
    ("q1", "Un medico ti ha mai detto che hai un problema al cuore?", True),
    ("q2", "Senti dolore al petto quando fai attività fisica, o ne hai sentito nell'ultimo mese a riposo?", True),
    ("q3", "Ti capita di perdere l'equilibrio per vertigini, o di svenire?", True),
    ("q4", "Hai un problema a ossa o articolazioni che peggiora con l'attività fisica?", False),
    ("q5", "Sei incinta, o lo sei stata negli ultimi sei mesi?", False),
    ("q6", "Prendi farmaci per la pressione o per il cuore?", False),
    ("q7", "Un medico ti ha detto di non fare attività fisica intensa?", True),
]
BLOCKING_TEXT_IT = (
    "Prima di iniziare, senti un medico. Una delle risposte ci dice che un controllo prima di allenarti con i "
    "pesi è la cosa giusta da fare. Se lo hai già fatto e hai il via libera, puoi continuare: il piano parte "
    "conservativo, con carichi leggeri e senza esercizi che caricano la colonna."
)

CONSTRAINT_KEYWORDS: list[tuple[str, list[str]]] = [
    (r"schiena|lombare|ernia|lombalgia|sciatic", ["hinge"]),
    (r"ginocchi", ["lunge"]),
    (r"spall", ["push_v"]),
    (r"gomit|pols", ["curl", "triceps"]),
]


def onboarding_schema(index: KnowledgeIndex) -> OnboardingSchemaOut:
    steps = [
        StepOut(id="goal", title_it="Cosa vuoi ottenere?", fields=[FieldOut(id="goal", type="single", label_it="Obiettivo", options=[
            OptionOut(id="hypertrophy", label_it="Mettere su muscolo", help_it="Volume medio, 8-12 ripetizioni"),
            OptionOut(id="strength", label_it="Diventare più forte", help_it="Carichi più alti, poche ripetizioni"),
            OptionOut(id="health", label_it="Stare bene e muovermi meglio", help_it="Carichi moderati, margine ampio"),
        ])]),
        StepOut(id="level", title_it="Da quanto ti alleni con i pesi?", fields=[FieldOut(id="level", type="single", label_it="Livello", options=[
            OptionOut(id="beginner", label_it="Meno di un anno, o sono tornato dopo una pausa", help_it="Non sai cosa sia il RIR: va bene, te lo spieghiamo"),
            OptionOut(id="intermediate", label_it="Più di un anno, con continuità", help_it="Conosci i movimenti base con il bilanciere"),
        ])]),
        StepOut(id="schedule", title_it="Quanto tempo hai?", fields=[
            FieldOut(id="days_per_week", type="single", label_it="Giorni a settimana", options=[OptionOut(id=str(d), label_it=str(d)) for d in (2, 3, 4, 5, 6)]),
            FieldOut(id="minutes_per_session", type="single", label_it="Minuti per seduta", options=[OptionOut(id=str(m), label_it=f"{m}" if m < 75 else "75+") for m in (30, 45, 60, 75)]),
        ]),
        StepOut(id="place", title_it="Dove ti alleni?", fields=[
            FieldOut(id="location", type="single", label_it="Luogo", options=[
                OptionOut(id="gym", label_it="In palestra", help_it="Bilancieri, manubri, macchine, cavi"),
                OptionOut(id="home_dumbbells", label_it="A casa con i manubri"),
                OptionOut(id="bodyweight", label_it="A corpo libero"),
            ]),
            FieldOut(id="equipment", type="multi", label_it="Hai anche", required=False, options=[
                OptionOut(id="band", label_it="Elastici"),
                OptionOut(id="pull_up_bar", label_it="Una sbarra per le trazioni"),
            ]),
        ]),
        StepOut(id="constraints", title_it="Vincoli", fields=[
            FieldOut(id="health_consent", type="single", label_it="Consenso ai dati su infortuni e dolori", help_it="Separato e revocabile da Account", required=False, options=[OptionOut(id="true", label_it="Acconsento"), OptionOut(id="false", label_it="Non adesso")]),
            FieldOut(id="constraints_text", type="text", label_it="Infortuni o dolori di cui il piano deve tenere conto", help_it="Compare solo con il consenso. Es. 'ernia lombare', 'ginocchio destro'", required=False),
        ]),
    ]
    return OnboardingSchemaOut(
        steps=steps,
        consent=ConsentOut(
            label_it="Acconsento al trattamento dei dati su infortuni e dolori (GDPR art. 9)",
            text_it="Servono solo ad adattare il piano. Li puoi cancellare quando vuoi da Account: il piano smette di tenerne conto.",
            note=note_for_rule(index, "system.health_consent"),
        ),
        disclaimer_it=DISCLAIMER_IT,
        gate=GateOut(
            title_it="Ultima cosa, per sicurezza",
            intro_it="Sette domande, sì o no. Non è una visita medica: serve a decidere se il piano parte normale o conservativo.",
            questions=[GateQuestionOut(id=q, text_it=t, blocking=b) for q, t, b in GATE_QUESTIONS],
            blocking_text_it=BLOCKING_TEXT_IT,
            acknowledge_label_it="Ho capito, continuo con un piano conservativo",
            note=note_for_rule(index, "safety.gate"),
        ),
    )


def avoid_patterns_from_text(text: str | None) -> list[str]:
    if not text:
        return []
    out: list[str] = []
    t = text.lower()
    for pat, patterns in CONSTRAINT_KEYWORDS:
        if re.search(pat, t):
            out.extend(p for p in patterns if p not in out)
    return out


async def submit(db: AsyncSession, settings: Settings, llm: LLMProvider, user: User, body: OnboardingIn) -> OnboardingOut:
    if body.constraints_text and not body.health_consent:
        raise UnprocessableError(
            "Per tenere conto di infortuni e dolori serve il consenso separato (GDPR art. 9).", code="health_consent_required"
        )
    blocking_yes = [q for q, _, b in GATE_QUESTIONS if b and body.safety_answers.get(q)]
    any_yes = any(body.safety_answers.values())
    if blocking_yes and not body.safety_acknowledged:
        raise Conflict(BLOCKING_TEXT_IT, code="safety_ack_required", blocking_questions=blocking_yes)

    existing = await plans_service.current_mesocycle(db, user.id)
    if existing is not None:
        closed = await plans_service.count_closed_sessions(db, user.id)
        if closed > 0 or existing.index > 1:
            raise Conflict("Il piano è già partito: per cambiarlo parla col coach o aspetta il prossimo blocco.", code="onboarding_locked")
        await db.delete(existing)
        await db.flush()

    profile = await db.get(Profile, user.id)
    now = datetime.now(UTC)
    if profile is None:
        profile = Profile(user_id=user.id, goal=body.goal, level=body.level, days_per_week=body.days_per_week, minutes_per_session=body.minutes_per_session, location=body.location)
        db.add(profile)
    profile.goal = body.goal
    profile.level = body.level
    profile.days_per_week = body.days_per_week
    profile.minutes_per_session = body.minutes_per_session
    profile.location = body.location
    profile.equipment = list(body.equipment)
    profile.safety_answers = dict(body.safety_answers)
    profile.safety_flagged = bool(blocking_yes)
    profile.conservative = bool(any_yes) or body.goal == "health"
    if body.health_consent:
        profile.health_consent_given = True
        profile.health_consent_at = profile.health_consent_at or now
        profile.constraints_text = body.constraints_text
        profile.avoid_patterns = avoid_patterns_from_text(body.constraints_text)
        if profile.avoid_patterns and "hinge" in profile.avoid_patterns:
            profile.conservative = True
    else:
        profile.health_consent_given = False
        profile.health_consent_at = None
        profile.constraints_text = None
        profile.avoid_patterns = []
    profile.onboarding_completed_at = now
    await db.flush()

    rules, catalog = await plans_service.engine_inputs(db)
    plan = generate_mesocycle(plans_service.profile_input(profile), rules, catalog, start=today_local(settings.timezone, now), index=1)
    meso = await plans_service.persist_plan(db, user, plan, rules)
    first = min((s for w in meso.weeks for s in w.sessions), key=lambda s: (s.date, s.index_in_week))

    index = await KnowledgeIndex.load(db)
    from app.services.notes import NoteBook

    nb = NoteBook(index)
    split_rule = next(r for r in plan.rule_ids if r.startswith("split.by_days."))
    for rid in (split_rule, f"volume.weekly_sets.{plan.tier}", f"rir.target.{plan.tier}"):
        nb.n(rid)
    context = (
        f"Profilo: obiettivo {body.goal}, livello {plan.tier}, {body.days_per_week} giorni, {body.minutes_per_session} minuti, {body.location}. "
        f"Split scelto: {plan.split}. Serie settimanali per muscolo: {rules[f'volume.weekly_sets.{plan.tier}'].value['sets']}. "
        f"RIR target: {rules[f'rir.target.{plan.tier}'].value['rir']}."
    )
    msg = await coach.create_proactive_message(db, llm, user, protocol="plan_comment", context=context, notes=nb.notes(), tier="base")
    await events.record(db, user.id, "onboarding_completed", {"goal": body.goal, "level": body.level, "days": body.days_per_week})
    await db.commit()
    return OnboardingOut(
        mesocycle=MesocycleBriefOut(index=1, week=1, total_weeks=meso.total_weeks, status="active"),
        first_session_id=first.id,
        coach_comment_message_id=msg.id,
        safety_notice_it=BLOCKING_TEXT_IT if blocking_yes else None,
    )


async def set_health_consent(db: AsyncSession, user: User, given: bool) -> HealthConsentOut:
    profile = await db.get(Profile, user.id)
    if profile is None:
        raise ApiError("Prima completa l'onboarding.", code="onboarding_required", status_code=409)
    now = datetime.now(UTC)
    if given:
        profile.health_consent_given = True
        profile.health_consent_at = profile.health_consent_at or now
        detail = "Consenso registrato. Da adesso il piano tiene conto di infortuni e dolori che scrivi."
    else:
        profile.health_consent_given = False
        profile.health_consent_at = None
        profile.constraints_text = None
        profile.avoid_patterns = []
        detail = "Consenso revocato. I dati su infortuni e dolori sono stati cancellati e il piano non ne tiene più conto."
    await db.commit()
    return HealthConsentOut(given=profile.health_consent_given, given_at=profile.health_consent_at, detail=detail)
