import pytest
from promptschema.errors import (
    LLMSchemaError,
    LLMSchemaValidationError,
    LLMSchemaRunError,
    LLMSchemaTimeoutError,
    LLMSchemaRateLimitError,
    ValidationIssue,
)


def test_base_error():
    e = LLMSchemaError("boom", name="p", version="1.0.0")
    assert str(e) == "boom"
    assert e.name == "p"
    assert e.version == "1.0.0"


def test_validation_error_message():
    issues = [
        ValidationIssue(field="lang", message='must be "es" or "en"', received="fr"),
        ValidationIssue(field="total", message="must be positive"),
    ]
    e = LLMSchemaValidationError("order-assistant", "1.0.0", issues)
    msg = str(e)
    assert "order-assistant" in msg
    assert "v1.0.0" in msg
    assert "lang" in msg
    assert "'fr'" in msg
    assert "total" in msg
    assert isinstance(e, LLMSchemaError)


def test_validation_error_issues():
    issues = [ValidationIssue(field="x", message="bad")]
    e = LLMSchemaValidationError("p", "1.0.0", issues)
    assert len(e.issues) == 1
    assert e.issues[0].field == "x"


def test_run_error():
    e = LLMSchemaRunError("p", "openai/gpt-4o", "API down")
    assert "p" in str(e)
    assert "openai/gpt-4o" in str(e)
    assert "API down" in str(e)
    assert e.model == "openai/gpt-4o"
    assert isinstance(e, LLMSchemaError)


def test_run_error_with_cause():
    cause = ValueError("original")
    e = LLMSchemaRunError("p", "m", "wrapped", cause=cause)
    assert e.cause is cause


def test_timeout_error():
    e = LLMSchemaTimeoutError("p", "m", timeout_ms=5000)
    assert "5000ms" in str(e)
    assert e.timeout_ms == 5000
    assert isinstance(e, LLMSchemaRunError)


def test_timeout_error_no_ms():
    e = LLMSchemaTimeoutError("p", "m")
    assert "timed out" in str(e)


def test_rate_limit_error():
    e = LLMSchemaRateLimitError("p", "m", retry_after_ms=30000)
    assert "rate limit" in str(e)
    assert "30000ms" in str(e)
    assert e.retry_after_ms == 30000
    assert isinstance(e, LLMSchemaRunError)


def test_rate_limit_error_no_retry():
    e = LLMSchemaRateLimitError("p", "m")
    assert "rate limit" in str(e)


def test_inheritance_chain():
    assert issubclass(LLMSchemaValidationError, LLMSchemaError)
    assert issubclass(LLMSchemaRunError, LLMSchemaError)
    assert issubclass(LLMSchemaTimeoutError, LLMSchemaRunError)
    assert issubclass(LLMSchemaRateLimitError, LLMSchemaRunError)
