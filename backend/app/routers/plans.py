from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Request, status

from app.clock import today_local
from app.deps import DbDep, SettingsDep, UserDep
from app.errors import NotFound
from app.schemas.common import ERROR_RESPONSES, ErrorOut
from app.schemas.plans import (
    HealthConsentIn,
    HealthConsentOut,
    MesocycleBriefOut,
    MesocycleCreatedOut,
    OnboardingIn,
    OnboardingOut,
    OnboardingSchemaOut,
    PlanOut,
    ProposalIn,
    ProposalOut,
    SummaryOut,
    TodayOut,
)
from app.services import entitlements as ent_service
from app.services import onboarding as onboarding_service
from app.services import plans as plans_service
from app.services import proposals as proposals_service
from app.services import today as today_service
from app.services.notes import KnowledgeIndex

router = APIRouter(tags=["plans"])


@router.get("/onboarding/schema", response_model=OnboardingSchemaOut, tags=["onboarding"], summary="I 5 passi + gate di sicurezza: contenuto, non codice")
async def onboarding_schema(db: DbDep) -> OnboardingSchemaOut:
    return onboarding_service.onboarding_schema(await KnowledgeIndex.load(db))


@router.post(
    "/onboarding",
    response_model=OnboardingOut,
    status_code=status.HTTP_201_CREATED,
    tags=["onboarding"],
    responses={
        409: {"model": ErrorOut, "description": "`safety_ack_required` (serve `safety_acknowledged: true`) · `onboarding_locked`"},
        422: {"model": ErrorOut, "description": "`validation_error` · `health_consent_required`"},
        **ERROR_RESPONSES,
    },
    summary="Invia le risposte: crea profilo, mesociclo 1 e il commento del coach",
)
async def onboarding(request: Request, body: OnboardingIn, db: DbDep, settings: SettingsDep, user: UserDep) -> OnboardingOut:
    return await onboarding_service.submit(db, settings, request.app.state.llm, user, body)


@router.post("/consents/health", response_model=HealthConsentOut, tags=["onboarding"], responses=ERROR_RESPONSES, summary="Consenso art. 9, separato e revocabile. La revoca cancella i dati.")
async def health_consent(body: HealthConsentIn, db: DbDep, user: UserDep) -> HealthConsentOut:
    return await onboarding_service.set_health_consent(db, user, body.given)


@router.get("/today", response_model=TodayOut, tags=["today"], responses={404: {"model": ErrorOut, "description": "`no_plan`"}, **ERROR_RESPONSES})
async def today(request: Request, db: DbDep, settings: SettingsDep, user: UserDep) -> TodayOut:
    return await today_service.build_today(db, settings, request.app.state.llm, user)


@router.get("/plans/current", response_model=PlanOut, responses={404: {"model": ErrorOut, "description": "`no_plan`"}, **ERROR_RESPONSES})
async def plan_current(db: DbDep, user: UserDep) -> PlanOut:
    today_ = today_local()
    meso = await plans_service.require_mesocycle(db, user.id, load_all=True)
    ent = await ent_service.get_entitlement(db, user)
    await plans_service.refresh_status(db, meso, user, today_)
    if meso.status == "maintenance":
        rules, catalog = await plans_service.engine_inputs(db)
        await plans_service.ensure_maintenance_weeks(db, meso, user, today_, rules, catalog)
    out = await plans_service.build_plan_out(db, meso, user, ent, today_)
    await db.commit()
    return out


@router.post("/plans/maintenance", response_model=PlanOut, responses={409: {"model": ErrorOut, "description": "`block_not_completed`"}, **ERROR_RESPONSES}, summary="Continua in mantenimento (gratis): la settimana si ripete")
async def plan_maintenance(db: DbDep, user: UserDep) -> PlanOut:
    today_ = today_local()
    meso = await plans_service.require_mesocycle(db, user.id, load_all=True)
    ent = await ent_service.get_entitlement(db, user)
    await plans_service.refresh_status(db, meso, user, today_)
    rules, catalog = await plans_service.engine_inputs(db)
    await plans_service.start_maintenance(db, meso, user, today_, rules, catalog)
    out = await plans_service.build_plan_out(db, meso, user, ent, today_)
    await db.commit()
    return out


@router.post(
    "/plans/mesocycles",
    response_model=MesocycleCreatedOut,
    status_code=status.HTTP_201_CREATED,
    responses={403: {"model": ErrorOut, "description": "`plan_required` (free)"}, 409: {"model": ErrorOut, "description": "`block_not_completed`"}, **ERROR_RESPONSES},
    summary="Costruisci il blocco successivo (Pro)",
)
async def plan_next(request: Request, db: DbDep, user: UserDep) -> MesocycleCreatedOut:
    today_ = today_local()
    ent = await ent_service.get_entitlement(db, user)
    rules, catalog = await plans_service.engine_inputs(db)
    meso = await plans_service.create_next_mesocycle(db, user, ent, today_, rules, catalog)
    first = min((s for w in meso.weeks for s in w.sessions), key=lambda s: (s.date, s.index_in_week))
    await db.commit()
    return MesocycleCreatedOut(
        mesocycle=MesocycleBriefOut(index=meso.index, week=1, total_weeks=meso.total_weeks, status="active"),
        first_session_id=first.id,
        coach_comment_message_id=None,
    )


@router.get("/mesocycles/{n}/summary", response_model=SummaryOut, responses={404: {"model": ErrorOut}, 409: {"model": ErrorOut, "description": "`block_not_completed`"}, **ERROR_RESPONSES}, summary="Riepilogo di fine blocco (superficie 1 del paywall)")
async def summary(n: int, request: Request, db: DbDep, settings: SettingsDep, user: UserDep) -> SummaryOut:
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.models import Mesocycle, PlannedExercise, PlannedSession, PlanWeek

    q = select(Mesocycle).where(Mesocycle.user_id == user.id, Mesocycle.index == n).options(*plans_service._FULL_LOAD)
    meso = (await db.execute(q)).scalar_one_or_none()
    if meso is None:
        raise NotFound("Questo blocco non esiste.")
    today_ = today_local()
    await plans_service.refresh_status(db, meso, user, today_)
    ent = await ent_service.get_entitlement(db, user)
    out = await plans_service.build_summary(db, settings, meso, user, ent, request.app.state.llm)
    if meso.summary_shown_at is None:
        meso.summary_shown_at = datetime.now(UTC)
    await db.commit()
    return out


_PROPOSAL_RESPONSES = {403: {"model": ErrorOut, "description": "`plan_required` (free fuori dal blocco 1)"}, 404: {"model": ErrorOut}, 409: {"model": ErrorOut, "description": "`proposal_not_applicable`"}, **ERROR_RESPONSES}


@router.post("/plans/proposals", response_model=ProposalOut, responses=_PROPOSAL_RESPONSES, summary="Proponi una modifica (da Settimana). Il motore valida; niente si applica finché non confermi.")
async def create_proposal(body: ProposalIn, db: DbDep, user: UserDep) -> ProposalOut:
    _, out = await proposals_service.create_proposal(db, user, body.patch, origin="user")
    await db.commit()
    return out


@router.get("/plans/proposals/{proposal_id}", response_model=ProposalOut, responses=_PROPOSAL_RESPONSES)
async def get_proposal(proposal_id: uuid.UUID, db: DbDep, user: UserDep) -> ProposalOut:
    return await proposals_service.get_proposal(db, user, proposal_id)


@router.post("/plans/proposals/{proposal_id}/apply", response_model=ProposalOut, responses=_PROPOSAL_RESPONSES, summary="Applica: l'unica scrittura sul piano che passa da una proposta")
async def apply_proposal(proposal_id: uuid.UUID, db: DbDep, user: UserDep) -> ProposalOut:
    out = await proposals_service.apply_proposal(db, user, proposal_id)
    await db.commit()
    return out


@router.post("/plans/proposals/{proposal_id}/reject", response_model=ProposalOut, responses=_PROPOSAL_RESPONSES)
async def reject_proposal(proposal_id: uuid.UUID, db: DbDep, user: UserDep) -> ProposalOut:
    out = await proposals_service.reject_proposal(db, user, proposal_id)
    await db.commit()
    return out
