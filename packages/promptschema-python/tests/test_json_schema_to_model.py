"""Unit tests for json_schema_to_model."""
import pytest
from pydantic import ValidationError

from promptschema.json_schema_to_model import json_schema_to_model
from promptschema.errors import LLMSchemaError


def test_converts_string_field():
    Model = json_schema_to_model("Test", {
        "type": "object",
        "properties": {"name": {"type": "string"}},
        "required": ["name"],
    })
    instance = Model(name="Oscar")
    assert instance.name == "Oscar"


def test_converts_number_field():
    Model = json_schema_to_model("Test", {
        "type": "object",
        "properties": {"total": {"type": "number"}},
        "required": ["total"],
    })
    instance = Model(total=3.14)
    assert instance.total == 3.14


def test_converts_integer_field():
    Model = json_schema_to_model("Test", {
        "type": "object",
        "properties": {"count": {"type": "integer"}},
        "required": ["count"],
    })
    instance = Model(count=42)
    assert instance.count == 42


def test_converts_boolean_field():
    Model = json_schema_to_model("Test", {
        "type": "object",
        "properties": {"active": {"type": "boolean"}},
        "required": ["active"],
    })
    instance = Model(active=True)
    assert instance.active is True


def test_converts_enum_field():
    Model = json_schema_to_model("Test", {
        "type": "object",
        "properties": {"lang": {"enum": ["es", "en"]}},
        "required": ["lang"],
    })
    instance = Model(lang="es")
    assert instance.lang.value == "es"

    with pytest.raises(ValidationError):
        Model(lang="fr")


def test_converts_array_field():
    Model = json_schema_to_model("Test", {
        "type": "object",
        "properties": {"tags": {"type": "array", "items": {"type": "string"}}},
        "required": ["tags"],
    })
    instance = Model(tags=["a", "b"])
    assert instance.tags == ["a", "b"]


def test_handles_optional_fields():
    Model = json_schema_to_model("Test", {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "age": {"type": "number"},
        },
        "required": ["name"],
    })
    instance = Model(name="Oscar")
    assert instance.name == "Oscar"
    assert instance.age is None


def test_validates_constraints_exclusive_minimum():
    Model = json_schema_to_model("Test", {
        "type": "object",
        "properties": {"total": {"type": "number", "exclusiveMinimum": 0}},
        "required": ["total"],
    })
    instance = Model(total=1)
    assert instance.total == 1

    with pytest.raises(ValidationError):
        Model(total=0)

    with pytest.raises(ValidationError):
        Model(total=-5)


def test_validates_constraints_min_length():
    Model = json_schema_to_model("Test", {
        "type": "object",
        "properties": {"name": {"type": "string", "minLength": 3}},
        "required": ["name"],
    })
    Model(name="Oscar")

    with pytest.raises(ValidationError):
        Model(name="ab")


def test_rejects_missing_required_fields():
    Model = json_schema_to_model("Test", {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "age": {"type": "number"},
        },
        "required": ["name", "age"],
    })
    with pytest.raises(ValidationError):
        Model(name="Oscar")


def test_throws_on_unsupported_type():
    with pytest.raises(LLMSchemaError):
        json_schema_to_model("Test", {"type": "null"})


def test_throws_on_non_object_root():
    with pytest.raises(LLMSchemaError):
        json_schema_to_model("Test", {"type": "string"})


def test_round_trip_pydantic_to_json_schema_to_dynamic():
    from pydantic import BaseModel
    from typing import Optional

    class Original(BaseModel):
        order: str
        total: float
        active: Optional[bool] = None

    json_schema = Original.model_json_schema()
    Reconstructed = json_schema_to_model("Reconstructed", json_schema)

    valid = {"order": "Dress", "total": 149.0}
    orig = Original(**valid)
    recon = Reconstructed(**valid)
    assert orig.order == recon.order
    assert orig.total == recon.total

    with pytest.raises(ValidationError):
        Reconstructed(total=10)
