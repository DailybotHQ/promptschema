from __future__ import annotations

import re
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from pydantic import BaseModel


def schema_to_json_schema(model_class: type[BaseModel]) -> dict[str, Any]:
    """Convert a Pydantic BaseModel to JSON Schema Draft 7, stripping metadata keys."""
    raw = model_class.model_json_schema()
    raw.pop("$defs", None)
    raw.pop("definitions", None)
    raw.pop("title", None)
    return raw


def normalize_template_output(raw: str) -> str:
    raw = re.sub(r"^\n+", "", raw)
    raw = re.sub(r"\n+$", "", raw)
    raw = re.sub(r"\n{3,}", "\n\n", raw)
    lines = raw.split("\n")
    lines = [re.sub(r"^[ \t]+", "", line) for line in lines]
    return "\n".join(lines).strip()
