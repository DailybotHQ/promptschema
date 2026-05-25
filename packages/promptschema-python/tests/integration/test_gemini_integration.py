"""Integration tests for the Gemini adapter (real API calls)."""
from __future__ import annotations

import pytest

from promptschema.errors import LLMSchemaRunError
from tests.integration.conftest import skip_no_gemini, create_test_prompt, MAX_TOKENS

Prompt = create_test_prompt("gemini/gemini-2.0-flash-lite")


@skip_no_gemini
@pytest.mark.asyncio
async def test_executes_prompt_and_returns_text():
    prompt = Prompt(message="Say hello in one word")
    result = await prompt.arun(max_tokens=MAX_TOKENS)
    assert result.text
    assert len(result.text) > 0


@skip_no_gemini
@pytest.mark.asyncio
async def test_returns_valid_token_usage():
    prompt = Prompt(message="Say hello in one word")
    result = await prompt.arun(max_tokens=MAX_TOKENS)
    assert result.usage.prompt_tokens > 0
    assert result.usage.completion_tokens > 0


@skip_no_gemini
@pytest.mark.asyncio
async def test_returns_estimated_cost_greater_than_zero():
    prompt = Prompt(message="Say hello in one word")
    result = await prompt.arun(max_tokens=MAX_TOKENS)
    assert result.usage.estimated_cost > 0


@skip_no_gemini
@pytest.mark.asyncio
async def test_tracks_latency():
    prompt = Prompt(message="Say hello in one word")
    result = await prompt.arun(max_tokens=MAX_TOKENS)
    assert result.latency_ms > 0
    assert result.latency_ms < 30_000


@skip_no_gemini
@pytest.mark.asyncio
async def test_throws_error_with_invalid_key():
    prompt = Prompt(message="Say hello")
    with pytest.raises(LLMSchemaRunError):
        await prompt.arun(api_key="invalid-gemini-key-for-testing", max_tokens=10)
