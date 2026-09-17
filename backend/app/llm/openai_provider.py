"""Provider OpenAI (seconda opzione), endpoint UE `eu.api.openai.com` (+10%, verifica #2). Chat Completions con tool.

Attivo con LLM_PROVIDER=openai e OPENAI_API_KEY. Embedding: text-embedding-3-small a 1536 dimensioni (<= 2000, indicizzabile).
Non verificato in questa sessione: nessuna chiave disponibile.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

from openai import AsyncOpenAI

from app.config import Settings
from app.llm.base import LLMResponse, Message, TextDelta, Tier, ToolCall, ToolSpec, Usage, estimate_cost_usd

EU_UPLIFT = 1.10


def _to_api_messages(system: str, messages: list[Message]) -> list[dict]:
    out: list[dict] = [{"role": "system", "content": system}]
    for m in messages:
        if m.role == "assistant":
            msg: dict = {"role": "assistant", "content": m.text or None}
            if m.tool_calls:
                msg["tool_calls"] = [{"id": tc.id, "type": "function", "function": {"name": tc.name, "arguments": json.dumps(tc.input, ensure_ascii=False)}} for tc in m.tool_calls]
            out.append(msg)
        elif m.tool_results:
            for tid, res in m.tool_results:
                out.append({"role": "tool", "tool_call_id": tid, "content": res})
        else:
            out.append({"role": "user", "content": m.text})
    return out


def _usage(u) -> Usage:
    details = getattr(u, "prompt_tokens_details", None)
    cached = int(getattr(details, "cached_tokens", 0) or 0) if details else 0
    prompt = int(getattr(u, "prompt_tokens", 0) or 0)
    return Usage(tokens_in=max(0, prompt - cached), tokens_out=int(getattr(u, "completion_tokens", 0) or 0), cache_read=cached, cache_write=0)


class OpenAIProvider:
    name = "openai"

    def __init__(self, settings: Settings):
        self._client = AsyncOpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
        self._models = {"base": settings.openai_model, "tone": settings.openai_model_tone}
        self._uplift = EU_UPLIFT if "eu.api.openai.com" in settings.openai_base_url else 1.0

    async def complete(self, *, system: str, messages: list[Message], tools: list[ToolSpec], max_tokens: int, tier: Tier) -> LLMResponse:
        model = self._models[tier]
        kwargs: dict = dict(model=model, messages=_to_api_messages(system, messages), max_completion_tokens=max_tokens, reasoning_effort="low" if tier == "base" else "medium")
        if tools:
            kwargs["tools"] = [{"type": "function", "function": {"name": t.name, "description": t.description, "parameters": t.input_schema, "strict": False}} for t in tools]
        resp = await self._client.chat.completions.create(**kwargs)
        choice = resp.choices[0]
        text = choice.message.content or ""
        calls = []
        for tc in choice.message.tool_calls or []:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            calls.append(ToolCall(id=tc.id, name=tc.function.name, input=args))
        return LLMResponse(text=text, tool_calls=calls, usage=_usage(resp.usage), model=model, stop_reason=choice.finish_reason or "stop")

    async def stream(self, *, system: str, messages: list[Message], max_tokens: int, tier: Tier) -> AsyncIterator[TextDelta | LLMResponse]:
        model = self._models[tier]
        stream = await self._client.chat.completions.create(model=model, messages=_to_api_messages(system, messages), max_completion_tokens=max_tokens, stream=True, stream_options={"include_usage": True})
        parts: list[str] = []
        usage = Usage()
        async for chunk in stream:
            if chunk.usage:
                usage = _usage(chunk.usage)
            for ch in chunk.choices:
                delta = ch.delta.content or ""
                if delta:
                    parts.append(delta)
                    yield TextDelta(text=delta)
        yield LLMResponse(text="".join(parts), tool_calls=[], usage=usage, model=model)

    def cost_usd(self, usage: Usage, model: str) -> float:
        return estimate_cost_usd(usage, model, eu_uplift=self._uplift)


class OpenAIEmbedder:
    name = "openai"

    def __init__(self, settings: Settings):
        self._client = AsyncOpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
        self._model = settings.embedding_model
        self.dimensions = settings.embedding_dimensions

    async def embed(self, texts: list[str]) -> list[list[float]]:
        resp = await self._client.embeddings.create(model=self._model, input=texts, dimensions=self.dimensions)
        return [d.embedding for d in resp.data]
