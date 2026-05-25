from __future__ import annotations

import hashlib
import inspect
import json
import os
import re
import tempfile
from dataclasses import dataclass, field
from typing import Any, Callable, TypedDict, TYPE_CHECKING

if TYPE_CHECKING:
    from pydantic import BaseModel

from promptschema.errors import LLMSchemaError
from promptschema.schema import schema_to_json_schema


REGISTRY_SCHEMA_URL = "https://promptschema.dev/registry.schema.json"
DEFAULT_REGISTRY_PATH = "promptschema.registry.json"


class RegistryHistoryEntry(TypedDict):
    version: str
    createdAt: str
    author: str
    templateHash: str
    schemaHash: str
    model: str
    changelog: str
    breaking: bool
    schema: dict[str, Any]


class RegistryPromptEntry(TypedDict):
    current: str
    history: list[RegistryHistoryEntry]


class Registry(TypedDict):
    version: str
    prompts: dict[str, RegistryPromptEntry]


BumpType = str  # "patch" | "minor" | "major"


@dataclass
class ChangeDetail:
    template_changed: bool = False
    schema_changed: bool = False
    model_changed: bool = False
    fields_added: list[str] = field(default_factory=list)
    fields_removed: list[str] = field(default_factory=list)
    fields_type_changed: list[str] = field(default_factory=list)
    suggested_bump: str | None = None


def create_empty_registry() -> Registry:
    return Registry(
        **{"$schema": REGISTRY_SCHEMA_URL},  # type: ignore[typeddict-item]
        version="1",
        prompts={},
    )


def read_registry(file_path: str = DEFAULT_REGISTRY_PATH) -> Registry:
    if not os.path.exists(file_path):
        return create_empty_registry()
    with open(file_path, encoding="utf-8") as f:
        raw = f.read()
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise LLMSchemaError(f"failed to parse registry at '{file_path}' — invalid JSON") from exc


def write_registry(file_path: str, registry: Registry) -> None:
    dir_path = os.path.dirname(file_path) or "."
    os.makedirs(dir_path, exist_ok=True)
    content = json.dumps(registry, indent=2, ensure_ascii=False) + "\n"
    fd, tmp = tempfile.mkstemp(dir=dir_path, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
        os.replace(tmp, file_path)
    except BaseException:
        os.unlink(tmp)
        raise


def get_prompt_entry(registry: Registry, name: str) -> RegistryPromptEntry | None:
    return registry.get("prompts", {}).get(name)


def get_history_entry(registry: Registry, name: str, version: str) -> RegistryHistoryEntry | None:
    entry = get_prompt_entry(registry, name)
    if not entry:
        return None
    for h in entry["history"]:
        if h["version"] == version:
            return h
    return None


# --- Hashing ---

def normalize_whitespace(text: str) -> str:
    lines = text.strip().split("\n")
    lines = [re.sub(r"[ \t]+", " ", line.strip()) for line in lines]
    return "\n".join(line for line in lines if line)


def _sha256_8(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:8]


def _stable_stringify(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def hash_template(template_fn: Callable[..., str]) -> str:
    source = inspect.getsource(template_fn)
    return _sha256_8(normalize_whitespace(source))


def hash_schema(model_class: type[BaseModel]) -> str:
    schema = schema_to_json_schema(model_class)
    return _sha256_8(_stable_stringify(schema))


# --- Change detection ---

def _diff_json_schemas(
    old: dict[str, Any], new: dict[str, Any]
) -> tuple[list[str], list[str], list[str]]:
    old_props = old.get("properties", {})
    new_props = new.get("properties", {})
    old_keys = set(old_props.keys())
    new_keys = set(new_props.keys())

    added = sorted(new_keys - old_keys)
    removed = sorted(old_keys - new_keys)
    type_changed: list[str] = []
    for key in sorted(old_keys & new_keys):
        if old_props[key].get("type") != new_props[key].get("type"):
            type_changed.append(key)
    return added, removed, type_changed


def detect_changes(
    template_fn: Callable[..., str],
    model_class: type[BaseModel],
    model: str,
    latest_entry: RegistryHistoryEntry,
) -> ChangeDetail:
    t_hash = hash_template(template_fn)
    s_hash = hash_schema(model_class)
    current_schema = schema_to_json_schema(model_class)

    template_changed = t_hash != latest_entry["templateHash"]
    schema_changed = s_hash != latest_entry["schemaHash"]
    model_changed = model != latest_entry["model"]

    added, removed, type_changed = _diff_json_schemas(latest_entry.get("schema", {}), current_schema)

    changes = ChangeDetail(
        template_changed=template_changed,
        schema_changed=schema_changed,
        model_changed=model_changed,
        fields_added=added,
        fields_removed=removed,
        fields_type_changed=type_changed,
    )
    changes.suggested_bump = suggest_bump(changes)
    return changes


def suggest_bump(changes: ChangeDetail) -> str | None:
    if changes.fields_removed or changes.fields_type_changed or changes.model_changed:
        return "major"
    if changes.fields_added or changes.schema_changed:
        return "minor"
    if changes.template_changed:
        return "patch"
    return None


# --- Version increment ---

def increment_version(current: str, bump: str) -> str:
    parts = current.split(".")
    if len(parts) != 3:
        raise LLMSchemaError(f"invalid semver version: '{current}'")
    try:
        major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])
    except ValueError as exc:
        raise LLMSchemaError(f"invalid semver version: '{current}'") from exc

    if bump == "major":
        return f"{major + 1}.0.0"
    if bump == "minor":
        return f"{major}.{minor + 1}.0"
    return f"{major}.{minor}.{patch + 1}"


# --- Register & Bump ---

def _generate_changelog(changes: ChangeDetail, model: str, old_model: str | None = None) -> str:
    parts: list[str] = []
    if changes.fields_removed:
        s = "s" if len(changes.fields_removed) > 1 else ""
        parts.append(f"removed field{s}: {', '.join(changes.fields_removed)}")
    if changes.fields_type_changed:
        parts.append(f"type changed: {', '.join(changes.fields_type_changed)}")
    if changes.fields_added:
        s = "s" if len(changes.fields_added) > 1 else ""
        parts.append(f"added field{s}: {', '.join(changes.fields_added)}")
    if changes.model_changed and old_model:
        parts.append(f"model changed from {old_model} to {model}")
    if changes.template_changed:
        parts.append("template modified")
    return ", ".join(parts) if parts else "no changes"


def register_prompt(
    registry: Registry,
    *,
    name: str,
    version: str,
    model: str,
    template_fn: Callable[..., str],
    model_class: type[BaseModel],
    author: str = "unknown",
) -> Registry:
    from datetime import datetime, timezone

    entry: RegistryHistoryEntry = {
        "version": version,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "author": author,
        "templateHash": hash_template(template_fn),
        "schemaHash": hash_schema(model_class),
        "model": model,
        "changelog": "initial version",
        "breaking": False,
        "schema": schema_to_json_schema(model_class),
    }

    new_prompts = dict(registry.get("prompts", {}))
    new_prompts[name] = {"current": version, "history": [entry]}
    return {**registry, "prompts": new_prompts}  # type: ignore[typeddict-item]


def bump_prompt(
    registry: Registry,
    *,
    name: str,
    model: str,
    template_fn: Callable[..., str],
    model_class: type[BaseModel],
    bump: str | None = None,
    changelog: str | None = None,
    author: str = "unknown",
) -> Registry:
    from datetime import datetime, timezone

    prompt_entry = get_prompt_entry(registry, name)
    if not prompt_entry:
        raise LLMSchemaError(f"prompt '{name}' not found in registry — use register_prompt() first")

    latest = prompt_entry["history"][0] if prompt_entry["history"] else None
    if not latest:
        raise LLMSchemaError(f"prompt '{name}' has empty history in registry")

    changes = detect_changes(template_fn, model_class, model, latest)
    bump_type = bump or changes.suggested_bump
    if not bump_type:
        raise LLMSchemaError(f"no changes detected for prompt '{name}' — nothing to bump")

    new_version = increment_version(prompt_entry["current"], bump_type)
    final_changelog = changelog or _generate_changelog(changes, model, latest["model"])

    new_entry: RegistryHistoryEntry = {
        "version": new_version,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "author": author,
        "templateHash": hash_template(template_fn),
        "schemaHash": hash_schema(model_class),
        "model": model,
        "changelog": final_changelog,
        "breaking": bump_type == "major",
        "schema": schema_to_json_schema(model_class),
    }

    new_prompts = dict(registry.get("prompts", {}))
    new_prompts[name] = {
        "current": new_version,
        "history": [new_entry, *prompt_entry["history"]],
    }
    return {**registry, "prompts": new_prompts}  # type: ignore[typeddict-item]


# --- Diff ---

def diff_prompt_versions(
    registry: Registry, name: str, v1: str, v2: str
) -> dict[str, Any]:
    entry = get_prompt_entry(registry, name)
    if not entry:
        raise LLMSchemaError(f"prompt '{name}' not found in registry")

    h1 = get_history_entry(registry, name, v1)
    h2 = get_history_entry(registry, name, v2)
    if not h1:
        raise LLMSchemaError(f"version '{v1}' not found for prompt '{name}'")
    if not h2:
        raise LLMSchemaError(f"version '{v2}' not found for prompt '{name}'")

    added, removed, type_changed = _diff_json_schemas(h1.get("schema", {}), h2.get("schema", {}))
    template_changed = h1["templateHash"] != h2["templateHash"]
    model_changed = h1["model"] != h2["model"]

    between = [
        h for h in entry["history"]
        if _version_gte(h["version"], v1) and not _version_gte(h["version"], v2)
    ]

    return {
        "name": name,
        "from_version": v1,
        "to_version": v2,
        "template_changed": template_changed,
        "model_old": h1["model"],
        "model_new": h2["model"],
        "model_changed": model_changed,
        "fields_added": added,
        "fields_removed": removed,
        "fields_type_changed": type_changed,
        "history": between,
    }


def _version_gte(a: str, b: str) -> bool:
    a_parts = [int(x) for x in a.split(".")]
    b_parts = [int(x) for x in b.split(".")]
    return a_parts >= b_parts


def format_diff(diff: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append(f"  prompt:  {diff['name']}")
    lines.append(f"  diff:    v{diff['from_version']} → v{diff['to_version']}")
    lines.append("")

    if diff["fields_added"] or diff["fields_removed"] or diff["fields_type_changed"]:
        lines.append("  schema")
        for f in diff["fields_added"]:
            lines.append(f"    + {f}")
        for f in diff["fields_removed"]:
            lines.append(f"    - {f}")
        for f in diff["fields_type_changed"]:
            lines.append(f"    ~ {f} (type changed)")
        lines.append("")

    if diff["template_changed"]:
        lines.append("  template")
        lines.append("    (modified)")
        lines.append("")

    model_line = f"  model: {diff['model_new']}"
    if diff["model_changed"]:
        model_line += f"  (was: {diff['model_old']})"
    else:
        model_line += "  (no change)"
    lines.append(model_line)

    if diff["history"]:
        lines.append("")
        lines.append("  bump history")
        for h in diff["history"]:
            date = h["createdAt"][:10] if h.get("createdAt") else "-"
            author = h.get("author", "-")
            changelog = h.get("changelog", "-")
            breaking = "  ⚠ breaking" if h.get("breaking") else ""
            lines.append(f"    v{h['version']}   {date}   {author}   {changelog}{breaking}")

    return "\n".join(lines)
