from __future__ import annotations

from typing import Any

from promptschema.errors import LLMSchemaRunError, LLMSchemaRateLimitError
from promptschema.adapters import register_adapter, require_env_var
from promptschema.adapters.pricing import estimate_cost

import os


class OpenAIAdapter:
    name = "openai"

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
    ) -> dict[str, Any]:
        try:
            from openai import AsyncOpenAI, RateLimitError, APIStatusError
        except ImportError:
            raise LLMSchemaRunError(
                prompt_name, f"openai/{model}",
                'openai SDK not installed — run: pip install promptschema[openai]',
            )

        full_model = f"openai/{model}"
        key = api_key or os.environ.get("OPENAI_API_KEY") or require_env_var("OPENAI_API_KEY", prompt_name, full_model)
        url = base_url or os.environ.get("OPENAI_BASE_URL")

        client = AsyncOpenAI(api_key=key, base_url=url)
        kwargs: dict[str, Any] = {"model": model, "messages": [{"role": "user", "content": prompt}]}
        if temperature is not None:
            kwargs["temperature"] = temperature
        if max_tokens is not None:
            kwargs["max_tokens"] = max_tokens

        try:
            response = await client.chat.completions.create(**kwargs)
        except RateLimitError:
            raise LLMSchemaRateLimitError(prompt_name, full_model)
        except APIStatusError as exc:
            raise LLMSchemaRunError(prompt_name, full_model, f"OpenAI API error {exc.status_code}: {exc.message}")

        usage = response.usage
        prompt_tokens = usage.prompt_tokens if usage else 0
        completion_tokens = usage.completion_tokens if usage else 0

        return {
            "text": response.choices[0].message.content or "",
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": (usage.total_tokens if usage else prompt_tokens + completion_tokens),
            "estimated_cost": estimate_cost(full_model, prompt_tokens, completion_tokens),
        }


register_adapter("openai", OpenAIAdapter())
