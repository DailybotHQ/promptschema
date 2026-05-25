import json
import os
import pytest
from promptschema.versioning import (
    create_empty_registry,
    read_registry,
    write_registry,
    get_prompt_entry,
    get_history_entry,
    normalize_whitespace,
    hash_template,
    hash_schema,
    increment_version,
    detect_changes,
    suggest_bump,
    register_prompt,
    bump_prompt,
    diff_prompt_versions,
    format_diff,
    ChangeDetail,
)
from promptschema.errors import LLMSchemaError
from pydantic import BaseModel


class SampleModel(BaseModel):
    name: str
    age: int


def sample_template(self) -> str:
    return f"Hello {self.name}, age {self.age}"


# --- Registry CRUD ---


def test_create_empty_registry():
    r = create_empty_registry()
    assert r["version"] == "1"
    assert r["prompts"] == {}


def test_write_and_read_registry(tmp_path):
    path = str(tmp_path / "registry.json")
    r = create_empty_registry()
    write_registry(path, r)
    loaded = read_registry(path)
    assert loaded["version"] == "1"


def test_read_missing_file():
    r = read_registry("/nonexistent/path.json")
    assert r["prompts"] == {}


def test_read_invalid_json(tmp_path):
    path = str(tmp_path / "bad.json")
    with open(path, "w") as f:
        f.write("{invalid")
    with pytest.raises(LLMSchemaError, match="invalid JSON"):
        read_registry(path)


def test_get_prompt_entry():
    r = create_empty_registry()
    assert get_prompt_entry(r, "x") is None

    r["prompts"]["x"] = {"current": "1.0.0", "history": []}
    assert get_prompt_entry(r, "x") is not None


def test_get_history_entry():
    r = create_empty_registry()
    r["prompts"]["x"] = {
        "current": "1.0.0",
        "history": [
            {"version": "1.0.0", "createdAt": "", "author": "", "templateHash": "", "schemaHash": "", "model": "", "changelog": "", "breaking": False, "schema": {}}
        ],
    }
    assert get_history_entry(r, "x", "1.0.0") is not None
    assert get_history_entry(r, "x", "2.0.0") is None


# --- Hashing ---


def test_normalize_whitespace():
    result = normalize_whitespace("  hello   world  \n  foo   bar  \n\n")
    assert result == "hello world\nfoo bar"


def test_hash_template_deterministic():
    h1 = hash_template(sample_template)
    h2 = hash_template(sample_template)
    assert h1 == h2
    assert len(h1) == 8


def test_hash_schema_deterministic():
    h1 = hash_schema(SampleModel)
    h2 = hash_schema(SampleModel)
    assert h1 == h2
    assert len(h1) == 8


# --- Version increment ---


def test_increment_patch():
    assert increment_version("1.2.3", "patch") == "1.2.4"


def test_increment_minor():
    assert increment_version("1.2.3", "minor") == "1.3.0"


def test_increment_major():
    assert increment_version("1.2.3", "major") == "2.0.0"


def test_increment_invalid():
    with pytest.raises(LLMSchemaError):
        increment_version("bad", "patch")


# --- Change detection ---


def test_suggest_bump_no_changes():
    c = ChangeDetail()
    assert suggest_bump(c) is None


def test_suggest_bump_template_only():
    c = ChangeDetail(template_changed=True)
    assert suggest_bump(c) == "patch"


def test_suggest_bump_fields_added():
    c = ChangeDetail(fields_added=["discount"])
    assert suggest_bump(c) == "minor"


def test_suggest_bump_fields_removed():
    c = ChangeDetail(fields_removed=["old_field"])
    assert suggest_bump(c) == "major"


# --- Register & Bump ---


def test_register_prompt():
    r = create_empty_registry()
    updated = register_prompt(
        r,
        name="test-prompt",
        version="1.0.0",
        model="openai/gpt-4o",
        template_fn=sample_template,
        model_class=SampleModel,
        author="oscar",
    )
    entry = updated["prompts"]["test-prompt"]
    assert entry["current"] == "1.0.0"
    assert len(entry["history"]) == 1
    assert entry["history"][0]["author"] == "oscar"


def test_bump_prompt():
    r = create_empty_registry()
    r = register_prompt(r, name="p", version="1.0.0", model="openai/gpt-4o", template_fn=sample_template, model_class=SampleModel)

    class UpdatedModel(BaseModel):
        name: str
        age: int
        discount: bool = False

    def updated_template(self) -> str:
        return f"Updated: {self.name}"

    bumped = bump_prompt(
        r,
        name="p",
        model="openai/gpt-4o",
        template_fn=updated_template,
        model_class=UpdatedModel,
    )
    assert bumped["prompts"]["p"]["current"] != "1.0.0"
    assert len(bumped["prompts"]["p"]["history"]) == 2


def test_bump_not_found():
    r = create_empty_registry()
    with pytest.raises(LLMSchemaError, match="not found"):
        bump_prompt(r, name="x", model="m", template_fn=sample_template, model_class=SampleModel)


# --- Diff ---


def test_diff_and_format():
    r = create_empty_registry()
    r = register_prompt(r, name="p", version="1.0.0", model="openai/gpt-4o", template_fn=sample_template, model_class=SampleModel)

    class V2Model(BaseModel):
        name: str
        age: int
        extra: str = ""

    def v2_template(self) -> str:
        return f"V2: {self.name}"

    r = bump_prompt(r, name="p", model="openai/gpt-4o", template_fn=v2_template, model_class=V2Model)
    new_version = r["prompts"]["p"]["current"]

    diff = diff_prompt_versions(r, "p", "1.0.0", new_version)
    assert diff["name"] == "p"
    assert diff["from_version"] == "1.0.0"
    assert "extra" in diff["fields_added"]

    output = format_diff(diff)
    assert "prompt:" in output
    assert "diff:" in output
