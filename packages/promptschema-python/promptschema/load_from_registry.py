from __future__ import annotations

import json
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from pydantic import BaseModel

from promptschema.errors import LLMSchemaError
from promptschema.json_schema_to_model import json_schema_to_model
from promptschema.schema import normalize_template_output
from promptschema.types import PromptResult
from promptschema.versioning import (
    DEFAULT_REGISTRY_PATH,
    read_registry,
)


def load_from_registry(
    name: str,
    *,
    registry_path: str = DEFAULT_REGISTRY_PATH,
    version: str | None = None,
) -> type[BaseModel]:
    """Load a prompt from the registry and return a runnable Pydantic model class."""

    registry = read_registry(registry_path)

    prompt_entry = registry.get("prompts", {}).get(name)
    if not prompt_entry:
        raise LLMSchemaError(
            f'prompt "{name}" not found in registry at "{registry_path}"'
        )

    target_version = version or prompt_entry["current"]
    history_entry = None
    for entry in prompt_entry["history"]:
        if entry["version"] == target_version:
            history_entry = entry
            break

    if not history_entry:
        raise LLMSchemaError(
            f'version "{target_version}" not found for prompt "{name}" in registry'
        )

    schema_data = history_entry.get("schema", {})
    if not schema_data or not schema_data.get("properties"):
        raise LLMSchemaError(
            f'prompt "{name}" v{target_version} has no schema in registry'
            " — cannot reconstruct validation"
        )

    model_name = name.replace("-", "_").title().replace("_", "")
    DynamicModel = json_schema_to_model(model_name, schema_data)

    prompt_name = name
    prompt_version = history_entry["version"]
    prompt_model = history_entry["model"]

    DynamicModel.prompt_name = prompt_name  # type: ignore[attr-defined]
    DynamicModel.prompt_version = prompt_version  # type: ignore[attr-defined]
    DynamicModel.prompt_model = prompt_model  # type: ignore[attr-defined]

    def render(self: Any) -> str:
        return json.dumps(self.model_dump(), indent=2, default=str)

    def run(self: Any, **kwargs: Any) -> PromptResult:
        from promptschema.runner import run_prompt_sync
        return run_prompt_sync(type(self), self, **kwargs)

    async def arun(self: Any, **kwargs: Any) -> PromptResult:
        from promptschema.runner import run_prompt_async
        return await run_prompt_async(type(self), self, **kwargs)

    def template(self: Any) -> str:
        return json.dumps(self.model_dump(), indent=2, default=str)

    DynamicModel.render = render  # type: ignore[attr-defined]
    DynamicModel.run = run  # type: ignore[attr-defined]
    DynamicModel.arun = arun  # type: ignore[attr-defined]
    DynamicModel.template = template  # type: ignore[attr-defined]

    return DynamicModel
