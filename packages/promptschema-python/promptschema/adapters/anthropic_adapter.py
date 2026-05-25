from __future__ import annotations

from typing import Any

from promptschema.errors import LLMSchemaRunError, LLMSchemaRateLimitError
from promptschema.adapters import register_adapter, require_env_var
from promptschema.adapters.pricing import estimate_cost

import os


class AnthropicAdapter:
    name = "anthropic"

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
            from anthropic import AsyncAnthropic, RateLimitError, APIStatusError
        except ImportError:
            raise LLMSchemaRunError(
                prompt_name, f"anthropic/{model}",
                'anthropic SDK not installed — run: pip install promptschema[anthropic]',
            )

        full_model = f"anthropic/{model}"
        key = api_key or os.environ.get("ANTHROPIC_API_KEY") or require_env_var("ANTHROPIC_API_KEY", prompt_name, full_model)

        client = AsyncAnthropic(api_key=key, base_url=base_url)
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens or 1024,
        }
        if temperature is not None:
            kwargs["temperature"] = temperature

        try:
            response = await client.messages.create(**kwargs)
        except RateLimitError:
            raise LLMSchemaRateLimitError(prompt_name, full_model)
        except APIStatusError as exc:
            raise LLMSchemaRunError(prompt_name, full_model, f"Anthropic API error {exc.status_code}: {exc.message}")

        prompt_tokens = response.usage.input_tokens
        completion_tokens = response.usage.output_tokens

        return {
            "text": response.content[0].text if response.content else "",
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
            "estimated_cost": estimate_cost(full_model, prompt_tokens, completion_tokens),
        }


register_adapter("anthropic", AnthropicAdapter())
