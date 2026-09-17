"""Messaggi proattivi del coach (commento al piano, giorno no, riepilogo). Non consumano quota.

Il testo lo genera l'LLM dentro un protocollo; le note e le opzioni le decide il motore/servizio.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.base import LLMProvider, Message, estimate_cost_usd
from app.models import ChatMessage, LlmUsage, User
from app.schemas.common import Note

log = structlog.get_logger()

SYSTEM_BASE = (
    "Sei il coach di fitcoach: un buon personal trainer su WhatsApp. Italiano. Frasi corte. "
    "Mai 'dovresti', mai punti esclamativi, mai 'campione', mai colpa. Il fatto, poi la scelta. "
    "Non decidi mai numeri del piano: li decide il motore. Non parli di cibo, peso o calorie. "
    "Non prometti risultati."
)

PROTOCOL_PROMPTS = {
    "plan_comment": (
        "[[PROTOCOL:plan_comment]] Commenta in tre frasi la scheda appena creata: perché questo split, "
        "questo volume, questa prossimità al cedimento. Segna le tre note esattamente così: [[1]] dopo la frase "
        "sullo split, [[2]] dopo quella sul volume, [[3]] dopo quella sulle ripetizioni in riserva. Non inventare numeri."
    ),
    "no_day": (
        "[[PROTOCOL:no_day]] La seduta di oggi non c'è stata. Apri con una frase che lo nomina come fatto, senza colpa, "
        "poi una domanda aperta su com'è andata la giornata. Massimo due frasi. Nessuna opzione ancora."
    ),
    "second_skip": (
        "[[PROTOCOL:second_skip]] Seconda seduta saltata di fila. Nominalo come dato, non come fallimento. "
        "Chiedi cosa le ha fatte saltare (tempo, energia, dolore, altro). Massimo due frasi."
    ),
    "return_after_break": (
        "[[PROTOCOL:return_after_break]] L'utente torna dopo più di due settimane. Accogli senza commentare l'assenza. "
        "Di' che il corpo ricorda e che si riparte un gradino sotto, con la nota [[1]]. Chiedi se preferisce corta o intera."
    ),
    "week_skipped": (
        "[[PROTOCOL:week_skipped]] Settimana senza sedute. Nominalo come fatto. Proponi corta o intera per le sedute rimaste."
    ),
    "block_summary": "[[PROTOCOL:block_summary]] Riassumi il blocco chiuso in un paragrafo con i numeri forniti, tre note [[1]] [[2]] [[3]].",
    "options_reply": "[[PROTOCOL:options_reply]] L'utente ha scelto un'opzione e il motore ha già ricalcolato. Conferma in una frase cosa cambia.",
}


async def generate_protocol_text(llm: LLMProvider, protocol: str, context: str, *, tier: str = "tone") -> tuple[str, object]:
    system = SYSTEM_BASE + "\n" + PROTOCOL_PROMPTS[protocol]
    resp = await llm.complete(
        system=system,
        messages=[Message(role="user", text=context)],
        tools=[],
        max_tokens=400,
        tier=tier,  # type: ignore[arg-type]
    )
    return resp.text.strip(), resp


async def record_usage(db: AsyncSession, provider: LLMProvider, user_id, message_id, resp, turn_kind: str, success: bool = True) -> None:
    usage = getattr(resp, "usage", None)
    model = getattr(resp, "model", provider.name)
    db.add(
        LlmUsage(
            user_id=user_id,
            message_id=message_id,
            provider=provider.name,
            model=model,
            turn_kind=turn_kind,
            tokens_in=usage.tokens_in if usage else 0,
            tokens_out=usage.tokens_out if usage else 0,
            tokens_cache_read=usage.cache_read if usage else 0,
            tokens_cache_write=usage.cache_write if usage else 0,
            cost_usd=provider.cost_usd(usage, model) if usage else 0.0,
            success=success,
        )
    )


async def create_proactive_message(
    db: AsyncSession,
    llm: LLMProvider,
    user: User,
    *,
    protocol: str,
    context: str,
    notes: list[Note],
    options: list[dict] | None = None,
    extra_blocks: list[dict] | None = None,
    tier: str = "tone",
) -> ChatMessage:
    text, resp = await generate_protocol_text(llm, protocol, context, tier=tier)
    blocks: list[dict] = [{"type": "paragraph", "text": text}]
    if options:
        blocks.append({"type": "options", "options": options})
    if extra_blocks:
        blocks.extend(extra_blocks)
    msg = ChatMessage(
        user_id=user.id,
        role="coach",
        kind="proactive",
        status="sent",
        text=text,
        blocks=blocks,
        notes=[n.model_dump(mode="json") for n in notes],
        protocol=protocol,
    )
    db.add(msg)
    await db.flush()
    await record_usage(db, llm, user.id, msg.id, resp, "proactive")
    return msg


def new_id() -> uuid.UUID:
    return uuid.uuid4()


def now() -> datetime:
    return datetime.now(UTC)
