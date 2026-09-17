"""Provider finto e deterministico: sviluppo senza chiave e test.

Regole (tutte leggibili qui, niente a caso):
- se il sistema contiene "[[PROTOCOL:" -> risposta di protocollo (apertura MI o opzioni) dal template;
- se l'ultimo messaggio utente chiede una modifica ("togli", "sostituisci", "cambia", "meno serie",
  "più serie", "aggiungi") -> chiama il tool `propose_plan_change`;
- se chiede "perché"/"quanto"/"studio"/"fonte" -> chiama `search_corpus` e poi risponde citando SOLO gli
  id dei chunk ricevuti nel tool result (formato [[cit:ID]]);
- se chiede lo storico ("storico", "ultima volta", "quanto facevo") -> `get_exercise_history`;
- altrimenti risposta breve, nel tono.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from collections.abc import AsyncIterator

from app.llm.base import LLMResponse, Message, TextDelta, Tier, ToolCall, ToolSpec, Usage

_CHANGE_WORDS = ("togli", "sostituisci", "cambia", "meno serie", "più serie", "aggiungi", "riduci", "sposta")
_WHY_WORDS = ("perché", "perche", "quanto", "studio", "fonte", "quante serie", "riposo", "rir")
_HISTORY_WORDS = ("storico", "ultima volta", "quanto facevo", "record")


def _last_user_text(messages: list[Message]) -> str:
    for m in reversed(messages):
        if m.role == "user" and m.text:
            return m.text.lower()
    return ""


def _tool_results(messages: list[Message]) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for m in messages:
        out.extend(m.tool_results)
    return out


def _usage(system: str, messages: list[Message], text: str) -> Usage:
    tokens_in = (len(system) + sum(len(m.text) for m in messages)) // 4
    return Usage(tokens_in=tokens_in, tokens_out=max(1, len(text) // 4))


class FakeLLM:
    name = "fake"
    model = "fake"

    def __init__(self) -> None:
        self.calls: list[dict] = []
        self.forced_text: str | None = None  # i test possono imporre una risposta (es. citazione inventata)
        self.fail_next: bool = False  # simula il provider giù

    async def complete(
        self, *, system: str, messages: list[Message], tools: list[ToolSpec], max_tokens: int, tier: Tier
    ) -> LLMResponse:
        self.calls.append({"system": system, "messages": messages, "tools": [t.name for t in tools], "tier": tier})
        if self.fail_next:
            self.fail_next = False
            raise RuntimeError("fake provider down")
        tool_names = {t.name for t in tools}
        user = _last_user_text(messages)
        results = _tool_results(messages)
        already_called = {tc.name for m in messages for tc in m.tool_calls}

        if self.forced_text is not None:
            text, self.forced_text = self.forced_text, None
            return LLMResponse(text=text, tool_calls=[], usage=_usage(system, messages, text), model=self.model)

        if "[[PROTOCOL:" in system:
            text = _protocol_text(system)
            return LLMResponse(text=text, tool_calls=[], usage=_usage(system, messages, text), model=self.model)

        if results:
            # secondo giro: rispondi usando i risultati dei tool
            text = _answer_from_results(results)
            return LLMResponse(text=text, tool_calls=[], usage=_usage(system, messages, text), model=self.model)

        if any(w in user for w in _CHANGE_WORDS) and "propose_plan_change" in tool_names and "propose_plan_change" not in already_called:
            patch = _patch_from_text(user)
            return LLMResponse(
                text="",
                tool_calls=[ToolCall(id="call_change", name="propose_plan_change", input=patch)],
                usage=_usage(system, messages, ""),
                model=self.model,
                stop_reason="tool_use",
            )
        if any(w in user for w in _HISTORY_WORDS) and "get_exercise_history" in tool_names:
            return LLMResponse(
                text="",
                tool_calls=[ToolCall(id="call_hist", name="get_exercise_history", input={"exercise": user, "n": 3})],
                usage=_usage(system, messages, ""),
                model=self.model,
                stop_reason="tool_use",
            )
        if any(w in user for w in _WHY_WORDS) and "search_corpus" in tool_names:
            return LLMResponse(
                text="",
                tool_calls=[ToolCall(id="call_search", name="search_corpus", input={"query": user})],
                usage=_usage(system, messages, ""),
                model=self.model,
                stop_reason="tool_use",
            )
        text = "Ci sono. Dimmi cosa ti serve: la seduta di oggi, un dubbio sulla tecnica, o come stai."
        return LLMResponse(text=text, tool_calls=[], usage=_usage(system, messages, text), model=self.model)

    async def stream(
        self, *, system: str, messages: list[Message], max_tokens: int, tier: Tier
    ) -> AsyncIterator[TextDelta | LLMResponse]:
        resp = await self.complete(system=system, messages=messages, tools=[], max_tokens=max_tokens, tier=tier)
        words = resp.text.split(" ")
        for i, w in enumerate(words):
            yield TextDelta(text=w if i == len(words) - 1 else w + " ")
        yield resp

    def cost_usd(self, usage: Usage, model: str) -> float:
        return 0.0


def _protocol_text(system: str) -> str:
    m = re.search(r"\[\[PROTOCOL:(\w+)\]\]", system)
    proto = m.group(1) if m else ""
    return {
        "plan_comment": (
            "Ecco la tua scheda. Ho scelto questo split perché con i tuoi giorni copre ogni gruppo muscolare "
            "almeno due volte a settimana[[1]]. Il volume parte basso e sale: le prime settimane servono a imparare "
            "i movimenti, non a stancarsi[[2]]. Fermati sempre con 2 ripetizioni in riserva: è lì che il lavoro "
            "rende senza costare troppo[[3]]."
        ),
        "no_day": "Oggi la seduta non c'è stata. Succede, e conta cosa facciamo domani. Com'è andata la giornata?",
        "second_skip": "Due sedute saltate di fila. Non è un problema da risolvere stasera: è un dato. Cosa le ha fatte saltare?",
        "return_after_break": "Bentornato. Sono passate più di due settimane: il corpo ricorda più di quanto credi[[1]]. Come riprendiamo?",
        "week_skipped": "Questa settimana è andata così. Ne restano altre. Vuoi una versione corta o quella intera?",
        "block_summary": "Blocco chiuso. I numeri sopra sono tuoi: su quelli costruisco il prossimo.",
        "options_reply": "Fatto. Ho sistemato la settimana come hai scelto: la trovi in Settimana.",
    }.get(proto, "Ci sono.")


def _answer_from_results(results: list[tuple[str, str]]) -> str:
    for _, content in results:
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and "chunks" in data:
            chunks = data["chunks"]
            if not chunks:
                return "Non ho una fonte su questo. Ti dico quello che so per esperienza, ma trattalo come tale."
            first = chunks[0]
            ids = [c["id"] for c in chunks[:2]]
            cites = " ".join(f"[[cit:{i}]]" for i in ids)
            return f"{first['text'][:220].rstrip()} {cites}"
        if isinstance(data, dict) and "history" in data:
            hist = data["history"]
            if not hist:
                return "Non ho ancora serie loggate per questo esercizio."
            last = hist[0]
            return f"L'ultima volta hai fatto {last['weight_kg']} kg per {last['reps']} con RIR {last['rir']}."
        if isinstance(data, dict) and "proposal_id" in data:
            if data.get("valid"):
                return "Ti propongo questa modifica: guardala e dimmi se la applico."
            return f"Non posso farlo così: {data.get('invalid_reason_it', 'la regola non lo permette')}."
        if isinstance(data, dict) and data.get("error") == "plan_required":
            return "Per cambiare il piano mi serve il blocco 2, e il blocco 2 è Pro. Intanto posso darti la versione corta o un giorno di riposo."
    return "Fatto."


def _patch_from_text(user: str) -> dict:
    if "togli" in user or "riduci" in user or "meno serie" in user:
        return {"op": "adjust_sets", "exercise_query": user, "delta": -1}
    if "più serie" in user or "aggiungi" in user:
        return {"op": "adjust_sets", "exercise_query": user, "delta": 1}
    if "sostituisci" in user or "cambia" in user:
        return {"op": "substitute", "exercise_query": user}
    return {"op": "adjust_sets", "exercise_query": user, "delta": -1}


class FakeEmbedder:
    name = "fake"

    def __init__(self, dimensions: int) -> None:
        self.dimensions = dimensions

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._one(t) for t in texts]

    def _one(self, text: str) -> list[float]:
        # bag-of-words hashing: deterministico e con una somiglianza minima per parole comuni
        vec = [0.0] * self.dimensions
        for w in re.findall(r"\w+", text.lower()):
            h = int(hashlib.md5(w.encode()).hexdigest(), 16)
            vec[h % self.dimensions] += 1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]
