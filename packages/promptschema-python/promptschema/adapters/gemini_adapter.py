from __future__ import annotations

from typing import Any

from promptschema.errors import LLMSchemaRunError, LLMSchemaRateLimitError
from promptschema.adapters import register_adapter, require_env_var
from promptschema.adapters.pricing import estimate_cost

import os


class GeminiAdapter:
    name = "gemini"

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
            import google.generativeai as genai
        except ImportError:
            raise LLMSchemaRunError(
                prompt_name, f"gemini/{model}",
                'google-generativeai SDK not installed — run: pip install promptschema[gemini]',
            )

        full_model = f"gemini/{model}"
        key = (
            api_key
            or os.environ.get("GEMINI_API_KEY")
            or os.environ.get("GOOGLE_API_KEY")
            or require_env_var("GEMINI_API_KEY", prompt_name, full_model)
        )
        genai.configure(api_key=key)

        gen_model = genai.GenerativeModel(model)
        config: dict[str, Any] = {}
        if temperature is not None:
            config["temperature"] = temperature
        if max_tokens is not None:
            config["max_output_tokens"] = max_tokens

        try:
            response = await gen_model.generate_content_async(
                prompt,
                generation_config=config if config else None,
            )
        except Exception as exc:
            if "429" in str(exc) or "RESOURCE_EXHAUSTED" in str(exc):
                raise LLMSchemaRateLimitError(prompt_name, full_model)
            raise LLMSchemaRunError(prompt_name, full_model, f"Gemini API error: {exc}")

        usage = getattr(response, "usage_metadata", None)
        prompt_tokens = getattr(usage, "prompt_token_count", 0) or 0
        completion_tokens = getattr(usage, "candidates_token_count", 0) or 0

        return {
            "text": response.text or "",
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": getattr(usage, "total_token_count", 0) or prompt_tokens + completion_tokens,
            "estimated_cost": estimate_cost(full_model, prompt_tokens, completion_tokens),
        }


register_adapter("gemini", GeminiAdapter())
