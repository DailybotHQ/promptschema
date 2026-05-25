"""Integration tests for the Ollama adapter (local server)."""
from __future__ import annotations

import json
import os
import urllib.request

import pytest

from promptschema.errors import LLMSchemaRunError
from tests.integration.conftest import skip_no_ollama, create_test_prompt, MAX_TOKENS


def _get_ollama_model() -> str:
    base = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    try:
        req = urllib.request.Request(f"{base}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read())
            if data.get("models"):
                return data["models"][0]["name"].split(":")[0]
    except Exception:
        pass
    return "llama3"


OLLAMA_MODEL = _get_ollama_model()
Prompt = create_test_prompt(f"ollama/{OLLAMA_MODEL}")


@skip_no_ollama
@pytest.mark.asyncio
async def test_executes_prompt_and_returns_text():
    prompt = Prompt(message="Say hello in one word")
    result = await prompt.arun(max_tokens=MAX_TOKENS)
    assert result.text
    assert len(result.text) > 0


@skip_no_ollama
@pytest.mark.asyncio
async def test_returns_valid_token_usage():
    prompt = Prompt(message="Say hello in one word")
    result = await prompt.arun(max_tokens=MAX_TOKENS)
    assert result.usage.prompt_tokens > 0
    assert result.usage.completion_tokens > 0


@skip_no_ollama
@pytest.mark.asyncio
async def test_estimated_cost_is_zero():
    prompt = Prompt(message="Say hello in one word")
    result = await prompt.arun(max_tokens=MAX_TOKENS)
    assert result.usage.estimated_cost == 0


@skip_no_ollama
@pytest.mark.asyncio
async def test_tracks_latency():
    prompt = Prompt(message="Say hello in one word")
    result = await prompt.arun(max_tokens=MAX_TOKENS)
    assert result.latency_ms > 0


@pytest.mark.asyncio
async def test_throws_error_when_server_unreachable():
    Prompt = create_test_prompt("ollama/nonexistent")
    prompt = Prompt(message="Say hello")
    with pytest.raises(LLMSchemaRunError):
        await prompt.arun(base_url="http://localhost:59999", max_tokens=10)
