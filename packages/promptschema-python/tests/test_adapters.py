import pytest
from unittest.mock import AsyncMock, patch
from promptschema.adapters import register_adapter, resolve_adapter, require_env_var
from promptschema.adapters.pricing import estimate_cost, PRICING
from promptschema.errors import LLMSchemaRunError


# --- Adapter registry ---


def test_resolve_invalid_model_format():
    with pytest.raises(LLMSchemaRunError, match="provider/model"):
        resolve_adapter("gpt-4o", "test")


def test_resolve_unknown_provider():
    with pytest.raises(LLMSchemaRunError, match="unknown provider"):
        resolve_adapter("mystery/model", "test")


def test_register_and_resolve():
    mock = AsyncMock()
    mock.name = "custom"
    register_adapter("custom-test", mock)
    adapter, model_name = resolve_adapter("custom-test/my-model", "test")
    assert adapter is mock
    assert model_name == "my-model"


def test_register_empty_provider():
    with pytest.raises(LLMSchemaRunError):
        register_adapter("", AsyncMock())


# --- require_env_var ---


def test_require_env_var_present(monkeypatch):
    monkeypatch.setenv("TEST_KEY", "secret")
    assert require_env_var("TEST_KEY", "p", "m") == "secret"


def test_require_env_var_missing(monkeypatch):
    monkeypatch.delenv("TEST_KEY", raising=False)
    with pytest.raises(LLMSchemaRunError, match="TEST_KEY"):
        require_env_var("TEST_KEY", "p", "m")


# --- Pricing ---


def test_pricing_has_major_providers():
    providers = {k.split("/")[0] for k in PRICING}
    assert "openai" in providers
    assert "anthropic" in providers
    assert "gemini" in providers


def test_estimate_cost_known():
    cost = estimate_cost("openai/gpt-4o", 1000, 500)
    expected = 1000 * PRICING["openai/gpt-4o"]["input"] + 500 * PRICING["openai/gpt-4o"]["output"]
    assert abs(cost - expected) < 1e-10


def test_estimate_cost_unknown():
    assert estimate_cost("unknown/model", 1000, 500) == 0.0
