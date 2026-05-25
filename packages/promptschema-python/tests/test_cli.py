import json
import os
import pytest
from unittest.mock import patch

from promptschema.cli import cmd_init, cmd_list, cmd_status, cmd_validate, cmd_bump, cmd_history
from promptschema.versioning import DEFAULT_REGISTRY_PATH


def _make_registry(prompts=None):
    return {"$schema": "", "version": "1", "prompts": prompts or {}}


def _make_entry(current="1.0.0", synced=True):
    return {
        "current": current,
        "history": [
            {
                "version": current if synced else "0.9.0",
                "createdAt": "2026-05-25T10:00:00.000Z",
                "author": "oscar",
                "templateHash": "abc",
                "schemaHash": "def",
                "model": "openai/gpt-4o",
                "changelog": "initial",
                "breaking": False,
                "schema": {},
            }
        ],
    }


class FakeArgs:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


# --- init ---

def test_init_creates_registry(tmp_path, capsys):
    with patch("promptschema.cli.os.getcwd", return_value=str(tmp_path)):
        cmd_init(FakeArgs())
    output = capsys.readouterr().out
    assert "Registry created" in output
    assert os.path.exists(tmp_path / DEFAULT_REGISTRY_PATH)


def test_init_already_exists(tmp_path, capsys):
    (tmp_path / DEFAULT_REGISTRY_PATH).write_text("{}")
    with patch("promptschema.cli.os.getcwd", return_value=str(tmp_path)):
        cmd_init(FakeArgs())
    output = capsys.readouterr().out
    assert "already exists" in output


# --- list ---

def test_list_empty(tmp_path, capsys):
    reg_path = tmp_path / DEFAULT_REGISTRY_PATH
    reg_path.write_text(json.dumps(_make_registry()))
    with patch("promptschema.cli.os.getcwd", return_value=str(tmp_path)):
        cmd_list(FakeArgs())
    assert "No prompts registered" in capsys.readouterr().out


def test_list_with_prompts(tmp_path, capsys):
    reg = _make_registry({"my-prompt": _make_entry()})
    (tmp_path / DEFAULT_REGISTRY_PATH).write_text(json.dumps(reg))
    with patch("promptschema.cli.os.getcwd", return_value=str(tmp_path)):
        cmd_list(FakeArgs())
    output = capsys.readouterr().out
    assert "my-prompt" in output
    assert "v1.0.0" in output
    assert "1 prompt registered" in output


# --- status ---

def test_status_synced(tmp_path, capsys):
    reg = _make_registry({"p": _make_entry(synced=True)})
    (tmp_path / DEFAULT_REGISTRY_PATH).write_text(json.dumps(reg))
    with patch("promptschema.cli.os.getcwd", return_value=str(tmp_path)):
        cmd_status(FakeArgs())
    assert "synced" in capsys.readouterr().out


def test_status_unsynced(tmp_path, capsys):
    reg = _make_registry({"p": _make_entry(current="2.0.0", synced=False)})
    (tmp_path / DEFAULT_REGISTRY_PATH).write_text(json.dumps(reg))
    with patch("promptschema.cli.os.getcwd", return_value=str(tmp_path)):
        cmd_status(FakeArgs())
    assert "need versioning" in capsys.readouterr().out


# --- validate ---

def test_validate_synced(tmp_path, capsys):
    reg = _make_registry({"p": _make_entry(synced=True)})
    (tmp_path / DEFAULT_REGISTRY_PATH).write_text(json.dumps(reg))
    with patch("promptschema.cli.os.getcwd", return_value=str(tmp_path)):
        cmd_validate(FakeArgs())
    assert "validated" in capsys.readouterr().out


def test_validate_unsynced(tmp_path, capsys):
    reg = _make_registry({"p": _make_entry(current="2.0.0", synced=False)})
    (tmp_path / DEFAULT_REGISTRY_PATH).write_text(json.dumps(reg))
    with patch("promptschema.cli.os.getcwd", return_value=str(tmp_path)):
        with pytest.raises(SystemExit) as exc_info:
            cmd_validate(FakeArgs())
        assert exc_info.value.code == 1


# --- bump ---

def test_bump_patch(tmp_path, capsys):
    reg = _make_registry({"my-prompt": _make_entry()})
    (tmp_path / DEFAULT_REGISTRY_PATH).write_text(json.dumps(reg))
    with patch("promptschema.cli.os.getcwd", return_value=str(tmp_path)):
        cmd_bump(FakeArgs(name="my-prompt", patch=True, minor=False, major=False))
    output = capsys.readouterr().out
    assert "v1.0.0" in output
    assert "v1.0.1" in output


def test_bump_major(tmp_path, capsys):
    reg = _make_registry({"p": _make_entry()})
    (tmp_path / DEFAULT_REGISTRY_PATH).write_text(json.dumps(reg))
    with patch("promptschema.cli.os.getcwd", return_value=str(tmp_path)):
        cmd_bump(FakeArgs(name="p", patch=False, minor=False, major=True))
    output = capsys.readouterr().out
    assert "v2.0.0" in output


# --- history ---

def test_history_with_entries(tmp_path, capsys):
    entry = _make_entry()
    entry["history"][0]["breaking"] = True
    reg = _make_registry({"p": entry})
    (tmp_path / DEFAULT_REGISTRY_PATH).write_text(json.dumps(reg))
    with patch("promptschema.cli.os.getcwd", return_value=str(tmp_path)):
        cmd_history(FakeArgs(name="p"))
    output = capsys.readouterr().out
    assert "v1.0.0" in output
    assert "breaking" in output


def test_history_not_found(tmp_path, capsys):
    reg = _make_registry()
    (tmp_path / DEFAULT_REGISTRY_PATH).write_text(json.dumps(reg))
    with patch("promptschema.cli.os.getcwd", return_value=str(tmp_path)):
        with pytest.raises(SystemExit):
            cmd_history(FakeArgs(name="unknown"))
