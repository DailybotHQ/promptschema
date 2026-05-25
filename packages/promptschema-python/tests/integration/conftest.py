from __future__ import annotations

import os
import urllib.request

import pytest
from pydantic import BaseModel

from promptschema import define_prompt

MAX_TOKENS = 50


def has_env(var: str) -> bool:
    return bool(os.environ.get(var))


def is_ollama_running() -> bool:
    base = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    try:
        req = urllib.request.Request(f"{base}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=3):
            return True
    except Exception:
        return False


skip_no_openai = pytest.mark.skipif(
    not has_env("OPENAI_API_KEY"),
    reason="OPENAI_API_KEY not set",
)

skip_no_anthropic = pytest.mark.skipif(
    not has_env("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set",
)

skip_no_gemini = pytest.mark.skipif(
    not has_env("GEMINI_API_KEY") and not has_env("GOOGLE_API_KEY"),
    reason="GEMINI_API_KEY / GOOGLE_API_KEY not set",
)

skip_no_ollama = pytest.mark.skipif(
    not is_ollama_running(),
    reason="Ollama server not running",
)


def create_test_prompt(model: str):
    @define_prompt(name="integration-test", version="1.0.0", model=model)
    class _Prompt(BaseModel):
        message: str

        def template(self) -> str:
            return self.message

    return _Prompt
