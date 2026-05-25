from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from promptschema.errors import LLMSchemaRunError

import os


@runtime_checkable
class LLMAdapter(Protocol):
    name: str

    async def call(
        self,
        *,
        model: str,
        prompt: str,
        temperature: float | None = None,
        max_tokens: int | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
        prompt_name: str = "(unknown)",
    ) -> dict[str, Any]: ...


_adapter_map: dict[str, LLMAdapter] = {}


def register_adapter(provider: str, adapter: LLMAdapter) -> None:
    if not provider:
        raise LLMSchemaRunError("(unknown)", "(unknown)", "provider name cannot be empty")
    _adapter_map[provider] = adapter


def resolve_adapter(
    model: str, prompt_name: str
) -> tuple[LLMAdapter, str]:
    if "/" not in model:
        raise LLMSchemaRunError(
            prompt_name,
            model,
            f'invalid model format "{model}" — expected "provider/model" (e.g. "openai/gpt-4o")',
        )
    provider, model_name = model.split("/", 1)
    adapter = _adapter_map.get(provider)
    if not adapter:
        available = ", ".join(_adapter_map.keys()) or "(none registered)"
        raise LLMSchemaRunError(
            prompt_name, model,
            f'unknown provider "{provider}" — available providers: {available}',
        )
    return adapter, model_name


def require_env_var(name: str, prompt_name: str, model: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise LLMSchemaRunError(
            prompt_name, model,
            f"missing environment variable {name}\n"
            f"  prompt '{prompt_name}' uses model '{model}'\n"
            f"  → Set {name} in your environment or pass api_key",
        )
    return value
