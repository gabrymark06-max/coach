"""Interfaccia del provider LLM. Nessun `temperature`/`top_p`/`top_k`: non sono esposti (verifica §7 #6).

Il coach usa solo questa interfaccia: cambiare modello o provider non tocca l'orchestratore.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol

Tier = Literal["base", "tone"]  # base: turni ordinari; tone: protocollo "giorno no"


@dataclass
class ToolSpec:
    name: str
    description: str
    input_schema: dict[str, Any]


@dataclass
class ToolCall:
    id: str
    name: str
    input: dict[str, Any]


@dataclass
class Message:
    """Messaggio neutro. `tool_results` è una lista di (tool_call_id, contenuto)."""

    role: Literal["user", "assistant"]
    text: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_results: list[tuple[str, str]] = field(default_factory=list)


@dataclass
class Usage:
    tokens_in: int = 0
    tokens_out: int = 0
    cache_read: int = 0
    cache_write: int = 0


@dataclass
class LLMResponse:
    text: str
    tool_calls: list[ToolCall]
    usage: Usage
    model: str
    stop_reason: str = "end_turn"


@dataclass
class TextDelta:
    text: str


class LLMProvider(Protocol):
    name: str

    async def complete(
        self, *, system: str, messages: list[Message], tools: list[ToolSpec], max_tokens: int, tier: Tier
    ) -> LLMResponse: ...

    def stream(
        self, *, system: str, messages: list[Message], max_tokens: int, tier: Tier
    ) -> AsyncIterator[TextDelta | LLMResponse]:
        """Emette TextDelta man mano, poi un LLMResponse finale (senza tool)."""
        ...

    def cost_usd(self, usage: Usage, model: str) -> float: ...


class Embedder(Protocol):
    name: str
    dimensions: int

    async def embed(self, texts: list[str]) -> list[list[float]]: ...


# Prezzi per 1M token (USD), da verifica.md #1 (2026-09-16). Servono solo alla stima in llm_usage.
PRICES_PER_M: dict[str, tuple[float, float, float, float]] = {
    # model: (input, output, cache_read, cache_write)
    "claude-sonnet-5": (2.0, 10.0, 0.20, 2.50),
    "claude-haiku-4-5": (1.0, 5.0, 0.10, 1.25),
    "claude-opus-5": (5.0, 25.0, 0.50, 6.25),
    "gpt-5.4-mini": (0.75, 4.50, 0.075, 0.0),
    "gpt-5.4": (2.50, 10.0, 0.25, 0.0),
    "gpt-5.4-nano": (0.20, 1.25, 0.02, 0.0),
    "text-embedding-3-small": (0.02, 0.0, 0.0, 0.0),
    "fake": (0.0, 0.0, 0.0, 0.0),
}


def estimate_cost_usd(usage: Usage, model: str, eu_uplift: float = 1.0) -> float:
    p = PRICES_PER_M.get(model)
    if p is None:
        return 0.0
    inp, out, cr, cw = p
    total = (usage.tokens_in * inp + usage.tokens_out * out + usage.cache_read * cr + usage.cache_write * cw) / 1e6
    return round(total * eu_uplift, 6)
