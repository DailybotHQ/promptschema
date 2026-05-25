import pytest
from unittest.mock import AsyncMock, patch
from pydantic import BaseModel

from promptschema import define_prompt
from promptschema.adapters import register_adapter
from promptschema.runner import run_prompt_async
from promptschema.errors import LLMSchemaRunError


@define_prompt(name="runner-test", version="1.0.0", model="mockprov/mock-model")
class RunnerTestPrompt(BaseModel):
    greeting: str

    def template(self) -> str:
        return f"Say: {self.greeting}"


mock_adapter = AsyncMock()
mock_adapter.name = "mockprov"
register_adapter("mockprov", mock_adapter)


@pytest.fixture(autouse=True)
def reset_mock():
    mock_adapter.call.reset_mock()
    mock_adapter.call.return_value = {
        "text": "mocked response",
        "prompt_tokens": 10,
        "completion_tokens": 5,
        "total_tokens": 15,
        "estimated_cost": 0.001,
    }


@pytest.mark.asyncio
async def test_run_prompt_async():
    instance = RunnerTestPrompt(greeting="hello")
    result = await run_prompt_async(RunnerTestPrompt, instance)

    assert result.text == "mocked response"
    assert result.usage.prompt_tokens == 10
    assert result.model == "mockprov/mock-model"
    assert result.version == "1.0.0"
    assert result.latency_ms >= 0

    mock_adapter.call.assert_called_once()
    call_kwargs = mock_adapter.call.call_args[1]
    assert call_kwargs["model"] == "mock-model"
    assert "Say: hello" in call_kwargs["prompt"]


@pytest.mark.asyncio
async def test_run_with_model_override():
    register_adapter("alt", mock_adapter)
    instance = RunnerTestPrompt(greeting="hi")
    result = await run_prompt_async(RunnerTestPrompt, instance, model="alt/alt-model")
    assert result.model == "alt/alt-model"


@pytest.mark.asyncio
async def test_run_wraps_unknown_errors():
    mock_adapter.call.side_effect = TypeError("network fail")
    instance = RunnerTestPrompt(greeting="hi")
    with pytest.raises(LLMSchemaRunError, match="network fail"):
        await run_prompt_async(RunnerTestPrompt, instance)


@pytest.mark.asyncio
async def test_run_rethrows_llm_errors():
    original = LLMSchemaRunError("p", "m", "rate limited")
    mock_adapter.call.side_effect = original
    instance = RunnerTestPrompt(greeting="hi")
    with pytest.raises(LLMSchemaRunError) as exc_info:
        await run_prompt_async(RunnerTestPrompt, instance)
    assert exc_info.value is original
