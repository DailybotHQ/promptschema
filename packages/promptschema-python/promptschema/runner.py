from __future__ import annotations

import asyncio
import time
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from pydantic import BaseModel

from promptschema.types import PromptResult, PromptUsage
from promptschema.errors import LLMSchemaRunError


def _load_adapters() -> None:
    """Lazy-load built-in adapters on first run."""
    try:
        import promptschema.adapters.openai_adapter  # noqa: F401
    except Exception:
        pass
    try:
        import promptschema.adapters.anthropic_adapter  # noqa: F401
    except Exception:
        pass
    try:
        import promptschema.adapters.gemini_adapter  # noqa: F401
    except Exception:
        pass
    try:
        import promptschema.adapters.ollama_adapter  # noqa: F401
    except Exception:
        pass


_adapters_loaded = False


def _ensure_adapters() -> None:
    global _adapters_loaded
    if not _adapters_loaded:
        _load_adapters()
        _adapters_loaded = True


async def run_prompt_async(
    prompt_class: type[BaseModel],
    instance: BaseModel,
    *,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    api_key: str | None = None,
    base_url: str | None = None,
) -> PromptResult:
    _ensure_adapters()
    from promptschema.adapters import resolve_adapter

    prompt_name: str = getattr(prompt_class, "prompt_name", "(unknown)")
    prompt_version: str = getattr(prompt_class, "prompt_version", "(unknown)")
    prompt_model: str = getattr(prompt_class, "prompt_model", "(unknown)")

    rendered: str = instance.render()  # type: ignore[attr-defined]
    effective_model = model or prompt_model

    adapter, model_name = resolve_adapter(effective_model, prompt_name)

    start = time.perf_counter()
    try:
        result = await adapter.call(
            model=model_name,
            prompt=rendered,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=api_key,
            base_url=base_url,
            prompt_name=prompt_name,
        )
    except LLMSchemaRunError:
        raise
    except Exception as exc:
        raise LLMSchemaRunError(
            prompt_name, effective_model,
            f"adapter call failed: {exc}",
            cause=exc if isinstance(exc, Exception) else None,
        )
    latency_ms = (time.perf_counter() - start) * 1000

    return PromptResult(
        text=result["text"],
        usage=PromptUsage(
            prompt_tokens=result["prompt_tokens"],
            completion_tokens=result["completion_tokens"],
            total_tokens=result["total_tokens"],
            estimated_cost=result["estimated_cost"],
        ),
        model=effective_model,
        version=prompt_version,
        latency_ms=latency_ms,
    )


def run_prompt_sync(
    prompt_class: type[BaseModel],
    instance: BaseModel,
    **kwargs: Any,
) -> PromptResult:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(asyncio.run, run_prompt_async(prompt_class, instance, **kwargs))
            return future.result()
    else:
        return asyncio.run(run_prompt_async(prompt_class, instance, **kwargs))
