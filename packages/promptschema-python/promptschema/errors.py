from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ValidationIssue:
    field: str
    message: str
    received: Any = None


class LLMSchemaError(Exception):
    def __init__(self, message: str, *, name: str = "(unknown)", version: str = "(unknown)") -> None:
        self.name = name
        self.version = version
        super().__init__(message)


class LLMSchemaValidationError(LLMSchemaError):
    def __init__(self, name: str, version: str, issues: list[ValidationIssue]) -> None:
        self.issues = issues
        lines = [f"input validation failed for prompt '{name}' v{version}"]
        for issue in issues:
            received = f" (received: {issue.received!r})" if issue.received is not None else ""
            lines.append(f"  ✗ {issue.field}: {issue.message}{received}")
        super().__init__("\n".join(lines), name=name, version=version)


class LLMSchemaRunError(LLMSchemaError):
    def __init__(
        self,
        name: str,
        model: str,
        message: str,
        cause: Exception | None = None,
    ) -> None:
        self.model = model
        self.cause = cause
        full = f"prompt '{name}' failed with model '{model}': {message}"
        super().__init__(full, name=name)


class LLMSchemaTimeoutError(LLMSchemaRunError):
    def __init__(self, name: str, model: str, timeout_ms: int | None = None) -> None:
        self.timeout_ms = timeout_ms
        msg = f"request timed out after {timeout_ms}ms" if timeout_ms else "request timed out"
        super().__init__(name, model, msg)


class LLMSchemaRateLimitError(LLMSchemaRunError):
    def __init__(self, name: str, model: str, retry_after_ms: int | None = None) -> None:
        self.retry_after_ms = retry_after_ms
        msg = "rate limit exceeded"
        if retry_after_ms:
            msg += f" — retry after {retry_after_ms}ms"
        super().__init__(name, model, msg)
