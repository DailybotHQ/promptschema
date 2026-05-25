"""Unit tests for load_from_registry."""
import json
import os
import tempfile

import pytest
from pydantic import ValidationError

from promptschema import load_from_registry
from promptschema.errors import LLMSchemaError


def _make_registry():
    return {
        "$schema": "https://promptschema.dev/registry.schema.json",
        "version": "1",
        "prompts": {
            "order-assistant": {
                "current": "2.0.0",
                "history": [
                    {
                        "version": "2.0.0",
                        "createdAt": "2026-05-25T10:00:00Z",
                        "author": "test",
                        "templateHash": "abc123",
                        "schemaHash": "def456",
                        "model": "openai/gpt-4o",
                        "changelog": "added discount field",
                        "breaking": False,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "order": {"type": "string"},
                                "lang": {"enum": ["es", "en"]},
                                "total": {"type": "number", "exclusiveMinimum": 0},
                                "discount": {"type": "boolean"},
                            },
                            "required": ["order", "lang", "total"],
                        },
                    },
                    {
                        "version": "1.0.0",
                        "createdAt": "2026-03-01T09:00:00Z",
                        "author": "test",
                        "templateHash": "xyz789",
                        "schemaHash": "uvw321",
                        "model": "openai/gpt-3.5-turbo",
                        "changelog": "initial version",
                        "breaking": False,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "order": {"type": "string"},
                                "lang": {"enum": ["es", "en"]},
                            },
                            "required": ["order", "lang"],
                        },
                    },
                ],
            },
        },
    }


@pytest.fixture()
def registry_path(tmp_path):
    path = str(tmp_path / "test.registry.json")
    with open(path, "w") as f:
        json.dump(_make_registry(), f)
    return path


def test_loads_prompt_and_returns_model(registry_path):
    Model = load_from_registry("order-assistant", registry_path=registry_path)

    assert Model.prompt_name == "order-assistant"
    assert Model.prompt_version == "2.0.0"
    assert Model.prompt_model == "openai/gpt-4o"


def test_validates_inputs_accepts_valid(registry_path):
    Model = load_from_registry("order-assistant", registry_path=registry_path)
    instance = Model(order="Dress", lang="en", total=149)

    assert instance.order == "Dress"
    assert instance.total == 149


def test_validates_inputs_accepts_optional(registry_path):
    Model = load_from_registry("order-assistant", registry_path=registry_path)
    instance = Model(order="Dress", lang="es", total=50, discount=True)

    assert instance.discount is True


def test_rejects_invalid_inputs(registry_path):
    Model = load_from_registry("order-assistant", registry_path=registry_path)

    with pytest.raises(ValidationError):
        Model(order="Dress")


def test_rejects_invalid_enum(registry_path):
    Model = load_from_registry("order-assistant", registry_path=registry_path)

    with pytest.raises(ValidationError):
        Model(order="Dress", lang="fr", total=10)


def test_renders_as_json(registry_path):
    Model = load_from_registry("order-assistant", registry_path=registry_path)
    instance = Model(order="Dress", lang="en", total=149)
    rendered = instance.render()

    parsed = json.loads(rendered)
    assert parsed["order"] == "Dress"
    assert parsed["total"] == 149


def test_loads_specific_version(registry_path):
    Model = load_from_registry(
        "order-assistant", registry_path=registry_path, version="1.0.0"
    )

    assert Model.prompt_version == "1.0.0"
    assert Model.prompt_model == "openai/gpt-3.5-turbo"

    instance = Model(order="Dress", lang="en")
    assert instance.order == "Dress"


def test_throws_if_prompt_not_found(registry_path):
    with pytest.raises(LLMSchemaError, match="not found"):
        load_from_registry("nonexistent", registry_path=registry_path)


def test_throws_if_version_not_found(registry_path):
    with pytest.raises(LLMSchemaError, match="not found"):
        load_from_registry(
            "order-assistant", registry_path=registry_path, version="9.9.9"
        )


def test_throws_if_schema_missing(registry_path):
    reg = _make_registry()
    reg["prompts"]["order-assistant"]["history"][0]["schema"] = {}

    with open(registry_path, "w") as f:
        json.dump(reg, f)

    with pytest.raises(LLMSchemaError, match="no schema"):
        load_from_registry("order-assistant", registry_path=registry_path)
