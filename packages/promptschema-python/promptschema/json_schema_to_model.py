from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, create_model

from promptschema.errors import LLMSchemaError


def _resolve_type(prop_schema: dict[str, Any], required: bool) -> tuple[type, Any]:
    """Convert a single JSON Schema property to a (type, Field) tuple."""

    if "enum" in prop_schema:
        values = prop_schema["enum"]
        if not values:
            raise LLMSchemaError("enum must have at least one value")
        enum_cls = Enum("_DynEnum", {v: v for v in values}, type=str)
        if required:
            return (enum_cls, ...)
        return (Optional[enum_cls], None)

    # Pydantic v2 uses anyOf for Optional types: anyOf: [{type: X}, {type: null}]
    if "anyOf" in prop_schema:
        any_of = prop_schema["anyOf"]
        non_null = [s for s in any_of if s.get("type") != "null"]
        if len(non_null) == 1:
            inner_type, _ = _resolve_type(non_null[0], required=True)
            return (Optional[inner_type], prop_schema.get("default"))
        raise LLMSchemaError(f"unsupported anyOf schema: {prop_schema}")

    schema_type = prop_schema.get("type")
    if not schema_type:
        raise LLMSchemaError(f"unsupported JSON Schema: missing 'type' field in {prop_schema}")

    if schema_type == "string":
        kwargs: dict[str, Any] = {}
        if "minLength" in prop_schema:
            kwargs["min_length"] = prop_schema["minLength"]
        if "maxLength" in prop_schema:
            kwargs["max_length"] = prop_schema["maxLength"]
        field = Field(**kwargs) if kwargs else (... if required else None)
        py_type = str if required else Optional[str]
        return (py_type, field)

    if schema_type == "number":
        kwargs = {}
        if "minimum" in prop_schema:
            kwargs["ge"] = prop_schema["minimum"]
        if "maximum" in prop_schema:
            kwargs["le"] = prop_schema["maximum"]
        if "exclusiveMinimum" in prop_schema:
            kwargs["gt"] = prop_schema["exclusiveMinimum"]
        if "exclusiveMaximum" in prop_schema:
            kwargs["lt"] = prop_schema["exclusiveMaximum"]
        field = Field(**kwargs) if kwargs else (... if required else None)
        py_type = float if required else Optional[float]
        return (py_type, field)

    if schema_type == "integer":
        kwargs = {}
        if "minimum" in prop_schema:
            kwargs["ge"] = prop_schema["minimum"]
        if "maximum" in prop_schema:
            kwargs["le"] = prop_schema["maximum"]
        field = Field(**kwargs) if kwargs else (... if required else None)
        py_type = int if required else Optional[int]
        return (py_type, field)

    if schema_type == "boolean":
        if required:
            return (bool, ...)
        return (Optional[bool], None)

    if schema_type == "array":
        items = prop_schema.get("items", {})
        inner_type = _resolve_simple_type(items)
        arr_type = list[inner_type]  # type: ignore[valid-type]
        if required:
            return (arr_type, ...)
        return (Optional[arr_type], None)  # type: ignore[valid-type]

    raise LLMSchemaError(f"unsupported JSON Schema type: '{schema_type}'")


def _resolve_simple_type(schema: dict[str, Any]) -> type:
    """Resolve a JSON Schema to a simple Python type (for array items)."""
    if "enum" in schema:
        return Enum("_DynEnum", {v: v for v in schema["enum"]}, type=str)  # type: ignore[return-value]
    t = schema.get("type", "string")
    mapping: dict[str, type] = {
        "string": str,
        "number": float,
        "integer": int,
        "boolean": bool,
    }
    if t not in mapping:
        raise LLMSchemaError(f"unsupported array item type: '{t}'")
    return mapping[t]


def json_schema_to_model(name: str, schema: dict[str, Any]) -> type[BaseModel]:
    """Convert a JSON Schema Draft 7 object into a dynamic Pydantic BaseModel."""
    if schema.get("type") != "object":
        raise LLMSchemaError(
            f"expected JSON Schema with type 'object', got '{schema.get('type')}'"
        )

    properties = schema.get("properties", {})
    required_fields = set(schema.get("required", []))

    field_definitions: dict[str, Any] = {}
    for field_name, prop_schema in properties.items():
        is_required = field_name in required_fields
        field_definitions[field_name] = _resolve_type(prop_schema, is_required)

    model = create_model(name, **field_definitions)

    if schema.get("additionalProperties") is False:
        model.model_config["extra"] = "forbid"

    return model
