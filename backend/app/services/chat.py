"""Orchestratore della chat. L'LLM propone via tool; il motore valida; l'utente conferma. L'LLM non scrive mai nel DB.

Sequenza di un turno utente:
  idempotenza (client_op_id) -> filtro di sicurezza (testo fisso, niente LLM, niente quota) -> quota (429)
  -> messaggio utente -> state card + tool loop -> validatore citazioni -> messaggio coach + llm_usage.
Un turno fallito (LLM giù) non conta nella quota: il messaggio utente resta con status=failed.
"""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.clock import today_local
from app.config import Settings
from app.errors import ApiError, Conflict, NotFound, PlanRequired, QuotaExceeded
from app.llm.base import Embedder, LLMProvider, LLMResponse, Message, ToolSpec, Usage
from app.llm.citations import validate_citations
from app.llm.retrieval import RetrievedChunk, search_corpus
from app.llm.safety import match_safety
from app.llm.state_card import build_state_card
from app.models import ChatMessage, Mesocycle, PlannedExercise, PlannedSession, User
from app.schemas.plans import ProposalPatchIn
from app.services import entitlements as ent_service
from app.services import events
from app.services import plans as plans_service
from app.services import proposals as proposals_service
from app.services import quota as quota_service
from app.services.coach import SYSTEM_BASE, generate_protocol_text, record_usage
from app.services.dates_it import human_date
from app.services.notes import KnowledgeIndex, NoteBook, note_for_rule

log = structlog.get_logger()

MAX_TOOL_ROUNDS = 4
HISTORY_TURNS = 8

TOOLS: list[ToolSpec] = [
    ToolSpec(name="get_exercise_history", description="Ultime N sedute in cui l'utente ha fatto un esercizio (nome libero).", input_schema={"type": "object", "properties": {"exercise": {"type": "string"}, "n": {"type": "integer", "minimum": 1, "maximum": 10}}, "required": ["exercise"]}),
    ToolSpec(name="get_session", description="La seduta di una data (YYYY-MM-DD) o 'today'/'next'.", input_schema={"type": "object", "properties": {"date": {"type": "string"}}, "required": ["date"]}),
    ToolSpec(name="search_corpus", description="Cerca nel corpus (regole con fonte, schede esercizio, protocolli). Cita SOLO gli id restituiti, nel formato [[cit:ID]].", input_schema={"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}),
    ToolSpec(name="propose_plan_change", description="Proponi una modifica al piano. Il motore la valida e l'utente la conferma: tu non applichi nulla.", input_schema={"type": "object", "properties": {"op": {"type": "string", "enum": ["adjust_sets", "substitute", "move_session"]}, "exercise_query": {"type": "string"}, "delta": {"type": "integer"}, "new_exercise_id": {"type": "string"}, "new_day_offset": {"type": "integer"}, "scope": {"type": "string", "enum": ["session", "rest_of_block"]}}, "required": ["op"]}),
    ToolSpec(name="renegotiate_week", description="Giorno no: applica una delle opzioni (short_tomorrow | move | rest | renegotiate). Il motore ricalcola.", input_schema={"type": "object", "properties": {"option": {"type": "string"}, "reason": {"type": "string"}}, "required": ["option"]}),
]

SYSTEM_CHAT = (
    SYSTEM_BASE
    + "\nHai una state card con il piano e lo storico: usala, non chiedere cose che sai già. "
    "Per rispondere a 'perché' usa search_corpus e cita con [[cit:ID]] solo gli id ricevuti. "
    "Per cambiare il piano usa propose_plan_change: proponi, non applicare. "
    "Se engine_active è no, per i cambi al piano di' che serve il blocco 2 (Pro) e offri versione corta o riposo. "
    "Se l'utente parla di dolore forte, sintomi cardiaci, cibo/peso o temi medici, rimanda a un professionista."
)


# ---------------------------------------------------------------- tool execution


class ToolContext:
    def __init__(self, db: AsyncSession, settings: Settings, user: User, embedder: Embedder, index: KnowledgeIndex, nb: NoteBook):
        self.db, self.settings, self.user, self.embedder, self.index, self.nb = db, settings, user, embedder, index, nb
        self.retrieved: dict[str, RetrievedChunk] = {}
        self.proposal_blocks: list[dict] = []
        self.proposal_ids: list[uuid.UUID] = []
        self.paywall: str | None = None
        self.applied_blocks: list[dict] = []

    async def run(self, name: str, args: dict[str, Any], message_id: uuid.UUID | None) -> str:
        try:
            if name == "search_corpus":
                chunks = await search_corpus(self.db, self.embedder, str(args.get("query", "")))
                for c in chunks:
                    self.retrieved[c.id] = c
                return json.dumps({"chunks": [{"id": c.id, "title": c.title_it, "text": c.text_it[:500]} for c in chunks]}, ensure_ascii=False)
            if name == "get_exercise_history":
                return json.dumps({"history": await _exercise_history(self.db, self.user, str(args.get("exercise", "")), int(args.get("n", 3)))}, ensure_ascii=False)
            if name == "get_session":
                return json.dumps(await _session_summary(self.db, self.user, str(args.get("date", "today"))), ensure_ascii=False)
            if name == "propose_plan_change":
                try:
                    patch = ProposalPatchIn(**{k: v for k, v in args.items() if k in ProposalPatchIn.model_fields})
                except Exception as e:  # input dell'LLM non valido: glielo diciamo
                    return json.dumps({"error": "invalid_patch", "detail": str(e)[:200]})
                try:
                    p, out = await proposals_service.create_proposal(self.db, self.user, patch, origin="coach", message_id=message_id)
                except PlanRequired:
                    self.paywall = "maintenance_request"
                    return json.dumps({"error": "plan_required"})
                block = {"type": "plan_change", "proposal_id": str(p.id), "diff": [d.model_dump(mode="json", by_alias=True) for d in out.diff], "applied": None if out.valid else False, "valid": out.valid, "invalid_reason_it": out.invalid_reason_it}
                self.proposal_blocks.append(block)
                self.proposal_ids.append(p.id)
                return json.dumps({"proposal_id": str(p.id), "valid": out.valid, "diff": block["diff"], "invalid_reason_it": out.invalid_reason_it}, ensure_ascii=False)
            if name == "renegotiate_week":
                try:
                    diff = (await apply_option(self.db, self.settings, self.user, str(args.get("option", "")), None)).diff
                except PlanRequired:
                    self.paywall = "maintenance_request"
                    return json.dumps({"error": "plan_required"})
                self.applied_blocks.append({"type": "plan_change", "proposal_id": str(uuid.uuid4()), "diff": diff, "applied": True, "valid": True, "invalid_reason_it": None})
                return json.dumps({"applied": True, "diff": diff}, ensure_ascii=False)
        except ApiError as e:
            return json.dumps({"error": e.code, "detail": e.detail}, ensure_ascii=False)
        return json.dumps({"error": "unknown_tool"})


async def _exercise_history(db: AsyncSession, user: User, query: str, n: int) -> list[dict]:
    words = [w for w in re.sub(r"[^a-z0-9 ]", " ", query.lower()).split() if len(w) > 3]
    q = (
        select(PlannedSession)
        .where(PlannedSession.user_id == user.id, PlannedSession.closed_at.is_not(None))
        .options(selectinload(PlannedSession.exercises).selectinload(PlannedExercise.set_rows), selectinload(PlannedSession.exercises).selectinload(PlannedExercise.exercise))
        .order_by(PlannedSession.date.desc())
        .limit(30)
    )
    out = []
    for s in (await db.execute(q)).scalars().all():
        for e in s.exercises:
            name = (e.exercise.name_it + " " + e.exercise.name_en).lower()
            if words and not any(w in name for w in words):
                continue
            done = [r for r in e.set_rows if r.status == "done"]
            if not done:
                continue
            best = max(done, key=lambda r: (float(r.logged_weight_kg or 0), r.logged_reps or 0))
            out.append({"date": s.date.isoformat(), "exercise": e.exercise.name_it, "sets": len(done), "weight_kg": float(best.logged_weight_kg) if best.logged_weight_kg is not None else None, "reps": best.logged_reps, "rir": best.logged_rir})
        if len(out) >= n:
            break
    return out[:n]


async def _session_summary(db: AsyncSession, user: User, when: str) -> dict:
    today = today_local()
    q = select(PlannedSession).where(PlannedSession.user_id == user.id).options(selectinload(PlannedSession.exercises).selectinload(PlannedExercise.exercise)).order_by(PlannedSession.date)
    sessions = list((await db.execute(q)).scalars().all())
    if when == "today":
        s = next((x for x in sessions if x.date == today), None)
    elif when == "next":
        s = next((x for x in sessions if x.date >= today and x.closed_at is None), None)
    else:
        try:
            d = datetime.fromisoformat(when).date()
        except ValueError:
            return {"error": "bad_date"}
        s = next((x for x in sessions if x.date == d), None)
    if s is None:
        return {"session": None}
    return {"session": {"date": s.date.isoformat(), "name": s.name, "status": s.status, "est_minutes": s.est_minutes, "exercises": [{"name": e.exercise.name_it, "sets": e.sets, "reps": f"{e.reps_min}-{e.reps_max}", "rir": e.rir_target, "removed_today": e.removed_today} for e in sorted(s.exercises, key=lambda x: x.order)]}}


# ---------------------------------------------------------------- turno utente


def _history_messages(rows: list[ChatMessage]) -> list[Message]:
    out: list[Message] = []
    for m in rows:
        if not m.text:
            continue
        out.append(Message(role="user" if m.role == "user" else "assistant", text=m.text[:1500]))
    return out


class TurnResult:
    def __init__(self, coach: ChatMessage, existing: bool = False):
        self.coach = coach
        self.existing = existing


async def _existing_reply(db: AsyncSession, user: User, client_op_id: str) -> ChatMessage | None:
    um = (await db.execute(select(ChatMessage).where(ChatMessage.user_id == user.id, ChatMessage.client_op_id == client_op_id))).scalar_one_or_none()
    if um is None or um.status == "failed":
        return None
    return (await db.execute(select(ChatMessage).where(ChatMessage.reply_to_id == um.id))).scalar_one_or_none()


async def prepare_turn(db: AsyncSession, settings: Settings, user: User, text: str, client_op_id: str) -> tuple[ChatMessage | None, ChatMessage | None]:
    """Prima dello stream: idempotenza, sicurezza, quota. Ritorna (risposta già pronta, messaggio utente nuovo)."""
    existing = await _existing_reply(db, user, client_op_id)
    if existing is not None:
        return existing, None
    old_failed = (await db.execute(select(ChatMessage).where(ChatMessage.user_id == user.id, ChatMessage.client_op_id == client_op_id))).scalar_one_or_none()
    if old_failed is not None:
        old_failed.client_op_id = f"{client_op_id}#failed-{uuid.uuid4().hex[:6]}"
        await db.flush()

    safety = match_safety(text)
    if safety is not None:
        um = ChatMessage(user_id=user.id, role="user", kind="safety", status="sent", text=text, blocks=[{"type": "paragraph", "text": text}], client_op_id=client_op_id)
        db.add(um)
        await db.flush()
        cm = ChatMessage(
            user_id=user.id,
            role="coach",
            kind="safety",
            status="sent",
            text=safety.text_it,
            blocks=[{"type": "safety", "text": safety.text_it, "options": [{"id": o["id"], "label": o["label"], "is_pro": False, "chosen": False} for o in safety.options]}],
            notes=[],
            protocol=safety.id,
            reply_to_id=um.id,
        )
        db.add(cm)
        await db.commit()
        return cm, None

    ent = await ent_service.get_entitlement(db, user)
    quota = await quota_service.get_quota(db, settings, user, ent_service.is_pro(ent))
    if quota.exhausted:
        await events.record(db, user.id, "paywall_shown", {"surface": "chat_quota"})
        await db.commit()
        raise QuotaExceeded(
            "Messaggi del mese finiti. Il coach continua a scriverti lui; per rispondergli prima del reset serve Pro.",
            resets_at=quota.resets_at.isoformat(),
            used=quota.used,
            limit=quota.limit,
        )
    um = ChatMessage(user_id=user.id, role="user", kind="user_turn", status="sent", text=text, blocks=[{"type": "paragraph", "text": text}], client_op_id=client_op_id)
    db.add(um)
    await db.commit()
    return None, um


async def run_turn(db: AsyncSession, settings: Settings, llm: LLMProvider, embedder: Embedder, user: User, um: ChatMessage) -> ChatMessage:
    """Tool loop + validatore. Solleva ApiError(llm_failed) se il provider non risponde: il turno non conta."""
    ent = await ent_service.get_entitlement(db, user)
    quota = await quota_service.get_quota(db, settings, user, ent_service.is_pro(ent))
    index = await KnowledgeIndex.load(db)
    nb = NoteBook(index)
    ctx = ToolContext(db, settings, user, embedder, index, nb)
    card = await build_state_card(db, user, quota)
    system = f"{SYSTEM_CHAT}\n\n[STATE CARD]\n{card}"
    hist_rows = (await db.execute(select(ChatMessage).where(ChatMessage.user_id == user.id, ChatMessage.id != um.id, ChatMessage.status == "sent").order_by(ChatMessage.created_at.desc()).limit(HISTORY_TURNS))).scalars().all()
    messages = _history_messages(list(reversed(hist_rows))) + [Message(role="user", text=um.text)]
    usage_total = Usage()
    model = llm.name
    resp: LLMResponse | None = None
    try:
        for _ in range(MAX_TOOL_ROUNDS + 1):
            resp = await llm.complete(system=system, messages=messages, tools=TOOLS, max_tokens=700, tier="base")
            usage_total.tokens_in += resp.usage.tokens_in
            usage_total.tokens_out += resp.usage.tokens_out
            usage_total.cache_read += resp.usage.cache_read
            usage_total.cache_write += resp.usage.cache_write
            model = resp.model
            if not resp.tool_calls:
                break
            messages.append(Message(role="assistant", text=resp.text, tool_calls=list(resp.tool_calls)))
            results = []
            for tc in resp.tool_calls:
                results.append((tc.id, await ctx.run(tc.name, tc.input, None)))
            messages.append(Message(role="user", tool_results=results))
    except ApiError:
        raise
    except Exception as e:
        log.exception("llm_failed", error_type=type(e).__name__)
        await _mark_turn_failed(db, llm, user, um, usage_total, model)
        raise ApiError("Il coach non ha risposto. Il tuo messaggio è salvato: riprova.", code="llm_failed", status_code=502) from e

    assert resp is not None
    validated = validate_citations(resp.text or "", ctx.retrieved, nb)
    text = validated.text or "Ci sono."
    blocks: list[dict] = [{"type": "paragraph", "text": text}]
    blocks.extend(ctx.applied_blocks)
    blocks.extend(ctx.proposal_blocks)
    if ctx.paywall:
        await events.record(db, user.id, "paywall_shown", {"surface": ctx.paywall})
        blocks.append({"type": "paywall", "surface": ctx.paywall, "context_line": PAYWALL_LINES[ctx.paywall], "resets_at": None})
    cm = ChatMessage(user_id=user.id, role="coach", kind="user_turn", status="sent", text=text, blocks=blocks, notes=[n.model_dump(mode="json") for n in nb.notes()], reply_to_id=um.id)
    db.add(cm)
    await db.flush()
    if ctx.proposal_ids:
        from app.models import PlanChangeProposal

        rows = (await db.execute(select(PlanChangeProposal).where(PlanChangeProposal.id.in_(ctx.proposal_ids)))).scalars().all()
        for p in rows:
            p.message_id = cm.id
    db.add(_usage_row(llm, user.id, cm.id, usage_total, model, success=True))
    await db.commit()
    return cm


async def _mark_turn_failed(db: AsyncSession, llm: LLMProvider, user: User, um: ChatMessage, usage: Usage, model: str) -> None:
    """Il turno non conta (contratto §8). Vale per qualunque errore del tool loop, anche una transazione Postgres
    abortita (QA B1): prima si chiude la transazione rotta, poi si scrive `failed` in una transazione nuova."""
    um_id, user_id = um.id, user.id  # il rollback scade gli oggetti: niente accessi lazy dopo
    await db.rollback()
    await db.execute(update(ChatMessage).where(ChatMessage.id == um_id).values(status="failed"))
    db.add(_usage_row(llm, user_id, um_id, usage, model, success=False))
    await db.commit()
    await db.refresh(um)


def _usage_row(llm: LLMProvider, user_id, message_id, usage: Usage, model: str, *, success: bool):
    from app.models import LlmUsage

    return LlmUsage(user_id=user_id, message_id=message_id, provider=llm.name, model=model, turn_kind="user_turn", tokens_in=usage.tokens_in, tokens_out=usage.tokens_out, tokens_cache_read=usage.cache_read, tokens_cache_write=usage.cache_write, cost_usd=llm.cost_usd(usage, model), success=success)


# ---------------------------------------------------------------- opzioni del giorno no


PAYWALL_LINES = {
    "end_of_block": "Il blocco 2 sui tuoi numeri: carichi ripartono dagli ultimi loggati, deload in settimana 4.",
    "chat_quota": "Messaggi del mese finiti. Il coach continua a scriverti lui; per rispondergli serve Pro.",
    "maintenance_request": "Rinegoziare la settimana e cambiare il piano sono il blocco 2: Pro.",
}
AI_BADGE_TEXT = "Parli con un coach AI, non con una persona. Le regole dietro ai numeri le hanno scritte delle persone."

OPTION_IDS = {"short_tomorrow", "move", "rest", "renegotiate", "full", "pause_plan", "remove_exercise", "acknowledge", "continue_anyway"}


@dataclass
class OptionOutcome:
    """Cosa ha fatto il motore per un'opzione, e cosa dice il coach.

    `reply_text` valorizzato = testo fisso (opzioni di sicurezza e scelte senza ricalcolo: la risposta è un fatto,
    non un commento, e non passa dall'LLM). `None` = il motore ha ricalcolato e l'LLM commenta il `context`.
    """

    diff: list[dict]
    context: str
    reply_text: str | None = None


def _next_session_line(nxt: PlannedSession | None) -> str:
    return f"La prossima seduta è {human_date(nxt.date)}: {nxt.name}, com'è nel piano." if nxt else "Non c'è una seduta in programma: la prossima arriva col blocco nuovo."


async def apply_option(db: AsyncSession, settings: Settings, user: User, option_id: str, message: ChatMessage | None) -> OptionOutcome:
    """Esegue l'opzione scelta. Ritorna diff, contesto per il coach e (se è un fatto) il testo fisso della risposta."""
    from app.engine import short_version
    from app.services import sessions as sessions_service

    today = today_local(settings.timezone)
    meso = await plans_service.require_mesocycle(db, user.id, load_all=True)
    ent = await ent_service.get_entitlement(db, user)
    active = ent_service.engine_active(ent, meso)
    rules, _ = await plans_service.engine_inputs(db)
    future = sorted((s for w in meso.weeks for s in w.sessions if s.closed_at is None and s.date >= today), key=lambda s: (s.date, s.index_in_week))
    nxt = future[0] if future else None
    diff: list[dict] = []

    if option_id == "short_tomorrow":
        if nxt is None:
            return OptionOutcome([], "Nessuna seduta in programma.", "Non c'è una seduta in programma da accorciare: la prossima arriva col blocco nuovo.")
        s = await sessions_service.load_session(db, user.id, nxt.id)
        before = {e.exercise_id: e.sets for e in s.exercises}
        spec = short_version(sessions_service.to_spec(s), rules)
        sessions_service.apply_spec(s, spec)
        s.updated_at = datetime.now(UTC)
        for e in s.exercises:
            if e.removed_today:
                diff.append({"exercise": e.exercise.name_it, "field": "oggi", "from": "in seduta", "to": "saltato", "note_n": None})
            elif e.exercise_id in before and before[e.exercise_id] != e.sets:
                diff.append({"exercise": e.exercise.name_it, "field": "sets", "from": before[e.exercise_id], "to": e.sets, "note_n": None})
        return OptionOutcome(diff, f"Prossima seduta {s.name} del {s.date.isoformat()} in versione corta ({s.est_minutes} minuti).")
    if option_id in ("move", "renegotiate"):
        if not active:
            raise PlanRequired()
        if nxt is None:
            return OptionOutcome([], "Nessuna seduta in programma.", "Non c'è una seduta in programma da spostare: la prossima arriva col blocco nuovo.")
        taken = {s.date for s in future}
        if option_id == "move":
            d = nxt.date + timedelta(days=1)
            while d in taken:
                d += timedelta(days=1)
            diff.append({"exercise": nxt.name, "field": "date", "from": nxt.date.isoformat(), "to": d.isoformat(), "note_n": None})
            nxt.date = d
            nxt.updated_at = datetime.now(UTC)
            return OptionOutcome(diff, f"Seduta {nxt.name} spostata a {d.isoformat()}.")
        week_n = plans_service.week_n_for(meso, today)
        remaining = [s for s in future if s.week_n == week_n]
        d = today + timedelta(days=1)
        for s in remaining:
            if s.date != d:
                diff.append({"exercise": s.name, "field": "date", "from": s.date.isoformat(), "to": d.isoformat(), "note_n": None})
                s.date = d
                s.updated_at = datetime.now(UTC)
            d += timedelta(days=1)
        return OptionOutcome(diff, f"Settimana {week_n} rinegoziata: {len(remaining)} sedute da domani, una al giorno.")
    if option_id == "rest":
        return OptionOutcome([], "Riposo: la prossima seduta resta com'è.", "Riposo, allora. " + _next_session_line(nxt))
    if option_id == "full":
        return OptionOutcome([], "Prossima seduta intera, com'è nel piano.", "Intera, allora. " + _next_session_line(nxt))
    if option_id == "acknowledge":
        return OptionOutcome([], "Ricevuto.", "Ricevuto. " + _next_session_line(nxt))
    if option_id == "continue_anyway":
        return OptionOutcome([], "L'utente va comunque alla seduta.", "Va bene. In seduta, se un esercizio fa male, su ognuno trovi Sostituisci e Salta: il piano non ne risente.")
    if option_id == "pause_plan":
        for s in future:
            s.date += timedelta(days=7)
            s.updated_at = datetime.now(UTC)
        for w in meso.weeks:
            if w.starts_on >= today - timedelta(days=6):
                w.starts_on += timedelta(days=7)
        meso.started_on += timedelta(days=7)
        restart = today + timedelta(days=7)
        diff.append({"exercise": "Piano", "field": "pausa", "from": today.isoformat(), "to": restart.isoformat(), "note_n": None})
        first = nxt.date if nxt is not None else restart  # `nxt` è già slittata di 7 giorni
        when = human_date(first) + (f" con {nxt.name}" if nxt is not None else "")
        return OptionOutcome(
            diff,
            f"Piano in pausa una settimana: tutte le sedute restanti sono spostate di 7 giorni. Riparte il {first.isoformat()}.",
            f"Piano in pausa per 7 giorni: tutte le sedute slittano di una settimana. Riparte {when}. Se per quella data il dolore c'è ancora, la pausa si allunga: basta dirmelo.",
        )
    if option_id == "remove_exercise":
        return OptionOutcome(
            [],
            "L'utente vuole togliere l'esercizio che fa male ma non ha ancora detto quale.",
            "Per toglierlo mi serve sapere quale: scrivimi qui l'esercizio che fa male e lo sostituisco dalla prossima seduta. In seduta trovi anche Sostituisci e Salta su ogni esercizio.",
        )
    if option_id.startswith("remove:"):
        pe_id = uuid.UUID(option_id.split(":", 1)[1])
        pe = await db.get(PlannedExercise, pe_id)
        if pe is None:
            raise NotFound("Questo esercizio non c'è.")
        pe.skipped = True
        return OptionOutcome([{"exercise": pe.exercise_id, "field": "oggi", "from": "in seduta", "to": "saltato", "note_n": None}], "Esercizio tolto dalla prossima seduta.")
    raise NotFound("Questa opzione non esiste.")


async def choose_option(db: AsyncSession, settings: Settings, llm: LLMProvider, user: User, option_id: str, message_id: uuid.UUID) -> ChatMessage:
    m = (await db.execute(select(ChatMessage).where(ChatMessage.id == message_id, ChatMessage.user_id == user.id))).scalar_one_or_none()
    if m is None:
        raise NotFound("Quel messaggio non c'è più.")
    import copy

    blocks = copy.deepcopy(list(m.blocks or []))  # mai mutare in place: l'ORM confronta vecchio e nuovo valore JSONB
    opt_block = next((b for b in blocks if b.get("type") in ("options", "safety")), None)
    options = (opt_block or {}).get("options") or []
    opt = next((o for o in options if o.get("id") == option_id), None)
    if opt is None:
        raise NotFound("Questa opzione non è tra quelle proposte.")
    if any(o.get("chosen") for o in options):
        raise Conflict("Hai già scelto per questo messaggio.", code="option_already_chosen")
    outcome = await apply_option(db, settings, user, option_id, m)
    for o in options:
        o["chosen"] = o.get("id") == option_id
    m.blocks = blocks
    if outcome.reply_text is not None:
        text, resp = outcome.reply_text, None  # un fatto: testo fisso, niente LLM
    else:
        text, resp = await generate_protocol_text(llm, "options_reply", outcome.context, tier="tone")
    reply_blocks: list[dict] = [{"type": "paragraph", "text": text}]
    if outcome.diff:
        reply_blocks.append({"type": "plan_change", "proposal_id": str(uuid.uuid4()), "diff": outcome.diff, "applied": True, "valid": True, "invalid_reason_it": None})
    cm = ChatMessage(user_id=user.id, role="coach", kind="proactive", status="sent", text=text, blocks=reply_blocks, notes=[], protocol="options_reply", reply_to_id=m.id)
    db.add(cm)
    await db.flush()
    if resp is not None:
        await record_usage(db, llm, user.id, cm.id, resp, "proactive")
    await events.record(db, user.id, "no_day_option_chosen", {"option": option_id, "message_id": str(m.id)})
    await db.commit()
    return cm


async def chat_texts(db: AsyncSession, settings: Settings) -> dict:
    index = await KnowledgeIndex.load(db)
    return {"ai_badge_text": AI_BADGE_TEXT, "ai_badge_note": note_for_rule(index, "system.about"), "paywall_context_line": dict(PAYWALL_LINES), "support_email": settings.support_email}
