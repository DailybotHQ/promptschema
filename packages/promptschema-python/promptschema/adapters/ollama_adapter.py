from __future__ import annotations

import json
from typing import Any
from urllib.request import urlopen, Request

from promptschema.errors import LLMSchemaRunError
from promptschema.adapters import register_adapter

import os


class OllamaAdapter:
    name = "ollama"

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
        full_model = f"ollama/{model}"
        url = base_url or os.environ.get("OLLAMA_BASE_URL") or "http://localhost:11434"

        body: dict[str, Any] = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
        }
        options: dict[str, Any] = {}
        if temperature is not None:
            options["temperature"] = temperature
        if max_tokens is not None:
            options["num_predict"] = max_tokens
        if options:
            body["options"] = options

        req = Request(
            f"{url}/api/chat",
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urlopen(req) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            raise LLMSchemaRunError(prompt_name, full_model, f"Ollama API error: {exc}")

        prompt_tokens = data.get("prompt_eval_count", 0) or 0
        completion_tokens = data.get("eval_count", 0) or 0

        return {
            "text": data.get("message", {}).get("content", ""),
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
            "estimated_cost": 0.0,
        }


register_adapter("ollama", OllamaAdapter())
