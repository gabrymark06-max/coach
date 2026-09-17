"""Provider Anthropic (SDK ufficiale, async). Attivo con LLM_PROVIDER=anthropic e ANTHROPIC_API_KEY.

Non esposto: temperature/top_p/top_k (rimossi sui modelli correnti). Il system prompt stabile va in cache
(prompt caching, prefix match); la state card, che cambia a ogni turno, sta dopo il breakpoint.
Nota residenza dati: first-party non ha regione UE (verifica #2) — la privacy policy deve dirlo.
Non verificato in questa sessione: nessuna chiave disponibile.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

from anthropic import AsyncAnthropic

from app.config import Settings
from app.llm.base import LLMResponse, Message, TextDelta, Tier, ToolCall, ToolSpec, Usage, estimate_cost_usd

STATE_MARK = "\n\n[STATE CARD]\n"


def _system_blocks(system: str) -> list[dict]:
    stable, _, volatile = system.partition(STATE_MARK)
    blocks: list[dict] = [{"type": "text", "text": stable, "cache_control": {"type": "ephemeral"}}]
    if volatile:
        blocks.append({"type": "text", "text": "[STATE CARD]\n" + volatile})
    return blocks


def _to_api_messages(messages: list[Message]) -> list[dict]:
    out: list[dict] = []
    for m in messages:
        if m.role == "assistant":
            content: list[dict] = []
            if m.text:
                content.append({"type": "text", "text": m.text})
            for tc in m.tool_calls:
                content.append({"type": "tool_use", "id": tc.id, "name": tc.name, "input": tc.input})
            out.append({"role": "assistant", "content": content or [{"type": "text", "text": ""}]})
        elif m.tool_results:
            out.append({"role": "user", "content": [{"type": "tool_result", "tool_use_id": tid, "content": res} for tid, res in m.tool_results]})
        else:
            out.append({"role": "user", "content": m.text})
    return out


def _usage(u) -> Usage:
    return Usage(
        tokens_in=int(getattr(u, "input_tokens", 0) or 0),
        tokens_out=int(getattr(u, "output_tokens", 0) or 0),
        cache_read=int(getattr(u, "cache_read_input_tokens", 0) or 0),
        cache_write=int(getattr(u, "cache_creation_input_tokens", 0) or 0),
    )


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, settings: Settings):
        self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._models = {"base": settings.anthropic_model, "tone": settings.anthropic_model_tone}

    async def complete(self, *, system: str, messages: list[Message], tools: list[ToolSpec], max_tokens: int, tier: Tier) -> LLMResponse:
        model = self._models[tier]
        kwargs: dict = dict(
            model=model,
            max_tokens=max_tokens,
            system=_system_blocks(system),
            messages=_to_api_messages(messages),
            output_config={"effort": "low" if tier == "base" else "medium"},
        )
        if tools:
            kwargs["tools"] = [{"name": t.name, "description": t.description, "input_schema": t.input_schema} for t in tools]
        resp = await self._client.messages.create(**kwargs)
        text = "".join(b.text for b in resp.content if b.type == "text")
        calls = [ToolCall(id=b.id, name=b.name, input=b.input if isinstance(b.input, dict) else json.loads(json.dumps(b.input))) for b in resp.content if b.type == "tool_use"]
        return LLMResponse(text=text, tool_calls=calls, usage=_usage(resp.usage), model=model, stop_reason=resp.stop_reason or "end_turn")

    async def stream(self, *, system: str, messages: list[Message], max_tokens: int, tier: Tier) -> AsyncIterator[TextDelta | LLMResponse]:
        model = self._models[tier]
        async with self._client.messages.stream(
            model=model, max_tokens=max_tokens, system=_system_blocks(system), messages=_to_api_messages(messages), output_config={"effort": "low" if tier == "base" else "medium"}
        ) as s:
            async for chunk in s.text_stream:
                yield TextDelta(text=chunk)
            final = await s.get_final_message()
        text = "".join(b.text for b in final.content if b.type == "text")
        yield LLMResponse(text=text, tool_calls=[], usage=_usage(final.usage), model=model, stop_reason=final.stop_reason or "end_turn")

    def cost_usd(self, usage: Usage, model: str) -> float:
        return estimate_cost_usd(usage, model)
