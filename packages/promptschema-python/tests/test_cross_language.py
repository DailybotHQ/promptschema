"""Cross-language round-trip tests using the shared fixture registry.

This test file uses the same JSON registry fixture as the TypeScript
cross-language tests, ensuring both languages produce identical behavior
from the same schema.
"""
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from promptschema import load_from_registry
from promptschema.errors import LLMSchemaError

FIXTURE_PATH = str(
    Path(__file__).resolve().parent.parent.parent
    / "promptschema"
    / "tests"
    / "cross-language"
    / "fixtures"
    / "test-registry.json"
)


class TestSharedFixtureRegistry:
    """Python loads the same shared fixture that TypeScript uses."""

    def test_loads_prompt_metadata(self):
        Model = load_from_registry(
            "order-assistant", registry_path=FIXTURE_PATH
        )

        assert Model.prompt_name == "order-assistant"
        assert Model.prompt_version == "1.0.0"
        assert Model.prompt_model == "openai/gpt-4o-mini"

    def test_validates_valid_input(self):
        Model = load_from_registry(
            "order-assistant", registry_path=FIXTURE_PATH
        )
        instance = Model(order="Dress", lang="en", total=149)

        assert instance.order == "Dress"
        assert instance.total == 149

    def test_accepts_optional_field(self):
        Model = load_from_registry(
            "order-assistant", registry_path=FIXTURE_PATH
        )
        instance = Model(order="Dress", lang="es", total=50, discount=True)

        assert instance.discount is True

    def test_rejects_missing_required(self):
        Model = load_from_registry(
            "order-assistant", registry_path=FIXTURE_PATH
        )

        with pytest.raises(ValidationError):
            Model(order="Dress")

    def test_rejects_invalid_enum(self):
        Model = load_from_registry(
            "order-assistant", registry_path=FIXTURE_PATH
        )

        with pytest.raises(ValidationError):
            Model(order="Dress", lang="fr", total=10)

    def test_renders_as_json(self):
        Model = load_from_registry(
            "order-assistant", registry_path=FIXTURE_PATH
        )
        instance = Model(order="Dress", lang="en", total=149)
        rendered = instance.render()

        parsed = json.loads(rendered)
        assert parsed["order"] == "Dress"
        assert parsed["total"] == 149

    def test_rejects_zero_total_exclusive_minimum(self):
        Model = load_from_registry(
            "order-assistant", registry_path=FIXTURE_PATH
        )

        with pytest.raises(ValidationError):
            Model(order="Dress", lang="en", total=0)

    def test_rejects_negative_total(self):
        Model = load_from_registry(
            "order-assistant", registry_path=FIXTURE_PATH
        )

        with pytest.raises(ValidationError):
            Model(order="Dress", lang="en", total=-5)
