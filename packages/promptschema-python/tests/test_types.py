from promptschema.types import PromptResult, PromptUsage


def test_prompt_usage_fields():
    u = PromptUsage(prompt_tokens=10, completion_tokens=5, total_tokens=15, estimated_cost=0.001)
    assert u.prompt_tokens == 10
    assert u.completion_tokens == 5
    assert u.total_tokens == 15
    assert u.estimated_cost == 0.001


def test_prompt_result_fields():
    u = PromptUsage(prompt_tokens=10, completion_tokens=5, total_tokens=15, estimated_cost=0.0)
    r = PromptResult(text="hello", usage=u, model="openai/gpt-4o", version="1.0.0", latency_ms=42.5)
    assert r.text == "hello"
    assert r.usage.prompt_tokens == 10
    assert r.model == "openai/gpt-4o"
    assert r.version == "1.0.0"
    assert r.latency_ms == 42.5


def test_frozen_dataclass():
    u = PromptUsage(prompt_tokens=1, completion_tokens=2, total_tokens=3, estimated_cost=0.0)
    try:
        u.prompt_tokens = 99  # type: ignore[misc]
        assert False, "should be frozen"
    except AttributeError:
        pass
