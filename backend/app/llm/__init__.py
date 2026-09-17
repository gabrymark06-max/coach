from __future__ import annotations

from app.config import Settings
from app.llm.base import Embedder, LLMProvider


def build_llm(settings: Settings) -> LLMProvider:
    if settings.llm_provider == "anthropic" and settings.anthropic_api_key:
        from app.llm.anthropic_provider import AnthropicProvider

        return AnthropicProvider(settings)
    if settings.llm_provider == "openai" and settings.openai_api_key:
        from app.llm.openai_provider import OpenAIProvider

        return OpenAIProvider(settings)
    from app.llm.fake import FakeLLM

    return FakeLLM()


def build_embedder(settings: Settings) -> Embedder:
    if settings.embedding_provider == "openai" and settings.openai_api_key:
        from app.llm.openai_provider import OpenAIEmbedder

        return OpenAIEmbedder(settings)
    from app.llm.fake import FakeEmbedder

    return FakeEmbedder(settings.embedding_dimensions)
