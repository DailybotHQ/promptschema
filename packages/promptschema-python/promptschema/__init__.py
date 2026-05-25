"""promptschema — typed, versioned prompts for LLMs."""

from promptschema.prompt import define_prompt
from promptschema.load_from_registry import load_from_registry
from promptschema.types import PromptResult, PromptUsage
from promptschema.errors import (
    LLMSchemaError,
    LLMSchemaValidationError,
    LLMSchemaRunError,
    LLMSchemaTimeoutError,
    LLMSchemaRateLimitError,
)

__version__ = "0.1.0"

__all__ = [
    "define_prompt",
    "load_from_registry",
    "PromptResult",
    "PromptUsage",
    "LLMSchemaError",
    "LLMSchemaValidationError",
    "LLMSchemaRunError",
    "LLMSchemaTimeoutError",
    "LLMSchemaRateLimitError",
]
