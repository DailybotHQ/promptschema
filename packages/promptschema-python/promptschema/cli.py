from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone

from promptschema.versioning import (
    DEFAULT_REGISTRY_PATH,
    create_empty_registry,
    read_registry,
    write_registry,
    get_prompt_entry,
    get_history_entry,
    increment_version,
    diff_prompt_versions,
    format_diff,
    RegistryHistoryEntry,
)


def _supports_color() -> bool:
    if os.environ.get("NO_COLOR") is not None:
        return False
    if os.environ.get("FORCE_COLOR") is not None:
        return True
    return hasattr(sys.stdout, "isatty") and sys.stdout.isatty()


def _wrap(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _supports_color() else text


def _green(t: str) -> str:
    return _wrap("32", t)


def _red(t: str) -> str:
    return _wrap("31", t)


def _yellow(t: str) -> str:
    return _wrap("33", t)


def _bold(t: str) -> str:
    return _wrap("1", t)


def _dim(t: str) -> str:
    return _wrap("2", t)


CHECK = "✔"
CROSS = "✗"
WARN = "⚠"
ARROW = "→"


def cmd_init(args: argparse.Namespace) -> None:
    path = os.path.join(os.getcwd(), DEFAULT_REGISTRY_PATH)
    if os.path.exists(path):
        print(f"  {_yellow(WARN)} Registry already exists at {DEFAULT_REGISTRY_PATH}")
        print(f"    Use {_green('promptschema status')} to check your prompts.")
        return
    registry = create_empty_registry()
    write_registry(path, registry)
    print(f"  {_green(CHECK)} Registry created at {DEFAULT_REGISTRY_PATH}")
    print()
    print("  Next steps:")
    print("    1. Define your first prompt with @define_prompt")
    print(f"    2. Run {_green('promptschema status')} to check sync state")


def cmd_list(args: argparse.Namespace) -> None:
    path = os.path.join(os.getcwd(), DEFAULT_REGISTRY_PATH)
    registry = read_registry(path)
    prompts = registry.get("prompts", {})
    if not prompts:
        print(f"  {_dim('No prompts registered.')}")
        print("  Define a prompt with @define_prompt and register it.")
        return

    rows: list[tuple[str, str, str, str]] = []
    for name, entry in prompts.items():
        hist = entry.get("history", [])
        latest = hist[0] if hist else None
        model = latest["model"] if latest else "-"
        date = latest["createdAt"][:10] if latest and latest.get("createdAt") else "-"
        rows.append((name, f"v{entry['current']}", model, date))

    headers = ("name", "version", "model", "last modified")
    col_widths = [max(len(h), *(len(r[i]) for r in rows)) for i, h in enumerate(headers)]
    header_line = "  ".join(h.ljust(w) for h, w in zip(headers, col_widths))
    separator = "─" * len(header_line)

    print()
    print(f"  {header_line}")
    print(f"  {separator}")
    for r in rows:
        print(f"  {'  '.join(c.ljust(w) for c, w in zip(r, col_widths))}")
    print()
    n = len(rows)
    print(f"  {_bold(str(n))} prompt{'s' if n != 1 else ''} registered.")


def cmd_status(args: argparse.Namespace) -> None:
    path = os.path.join(os.getcwd(), DEFAULT_REGISTRY_PATH)
    registry = read_registry(path)
    prompts = registry.get("prompts", {})
    if not prompts:
        print(f"  {_dim('No prompts registered.')}")
        print("  Define a prompt with @define_prompt and register it.")
        return

    unsynced = 0
    rows: list[tuple[str, str, str]] = []
    for name, entry in prompts.items():
        hist = entry.get("history", [])
        latest = hist[0] if hist else None
        synced = latest is not None and latest["version"] == entry["current"]
        if not synced:
            unsynced += 1
        state = _green(f"{CHECK} synced") if synced else _yellow(f"{WARN} unsynced")
        rows.append((name, f"v{entry['current']}", state))

    headers = ("prompt", "version", "state")
    col_widths = [max(len(h), *(len(r[i]) for r in rows)) for i, h in enumerate(headers)]
    header_line = "  ".join(h.ljust(w) for h, w in zip(headers, col_widths))
    separator = "─" * len(header_line)

    print()
    print(f"  {header_line}")
    print(f"  {separator}")
    for r in rows:
        print(f"  {'  '.join(c.ljust(w) for c, w in zip(r, col_widths))}")
    print()

    if unsynced > 0:
        print(f"  {unsynced} prompt{'s' if unsynced != 1 else ''} need versioning. Run {_green('promptschema bump <name>')}")
    else:
        print(f"  {_green(CHECK)} All prompts synced.")


def cmd_validate(args: argparse.Namespace) -> None:
    path = os.path.join(os.getcwd(), DEFAULT_REGISTRY_PATH)
    registry = read_registry(path)
    prompts = registry.get("prompts", {})
    if not prompts:
        print(f"  {_green(CHECK)} No prompts registered — nothing to validate.")
        return

    unsynced: list[str] = []
    for name, entry in prompts.items():
        hist = entry.get("history", [])
        latest = hist[0] if hist else None
        if not latest or latest["version"] != entry["current"]:
            unsynced.append(name)

    if not unsynced:
        n = len(prompts)
        print(f"  {_green(CHECK)} {n} prompt{'s' if n != 1 else ''} validated. Registry synced.")
        return

    for name in unsynced:
        print(f"  {_red(CROSS)} {name} has unversioned changes")
        print(f"    Run {_green(f'promptschema bump {name}')} before merging.")
    print()
    sys.exit(1)


def cmd_bump(args: argparse.Namespace) -> None:
    name = args.name
    if not name:
        print(f"  {_red(CROSS)} Missing prompt name.", file=sys.stderr)
        print("  Usage: promptschema bump <name> [--patch|--minor|--major]")
        sys.exit(1)

    path = os.path.join(os.getcwd(), DEFAULT_REGISTRY_PATH)
    registry = read_registry(path)
    entry = get_prompt_entry(registry, name)
    if not entry:
        available = list(registry.get("prompts", {}).keys())
        print(f"  {_red(CROSS)} Prompt \"{name}\" not found in registry.", file=sys.stderr)
        if available:
            print(f"  Available prompts: {', '.join(available)}")
        sys.exit(1)

    bump_type = "patch"
    if args.major:
        bump_type = "major"
    elif args.minor:
        bump_type = "minor"

    old_version = entry["current"]
    new_version = increment_version(old_version, bump_type)
    latest = entry["history"][0] if entry["history"] else None

    new_entry: RegistryHistoryEntry = {
        "version": new_version,
        "createdAt": datetime.now(tz=timezone.utc).isoformat(),
        "author": os.environ.get("USER", os.environ.get("USERNAME", "unknown")),
        "templateHash": latest["templateHash"] if latest else "",
        "schemaHash": latest["schemaHash"] if latest else "",
        "model": latest["model"] if latest else "",
        "changelog": f"{bump_type} bump via CLI",
        "breaking": bump_type == "major",
        "schema": latest.get("schema", {}) if latest else {},
    }

    new_prompts = dict(registry.get("prompts", {}))
    new_prompts[name] = {
        "current": new_version,
        "history": [new_entry, *entry["history"]],
    }
    updated = {**registry, "prompts": new_prompts}
    write_registry(path, updated)

    print()
    print(f"  {name}: v{old_version} {ARROW} v{new_version} ({bump_type})")
    print()
    print(f"  {_green(CHECK)} Registry updated at {DEFAULT_REGISTRY_PATH}")
    print(f"  {_green(CHECK)} Commit the registry to persist changes.")


def cmd_diff(args: argparse.Namespace) -> None:
    name, v1, v2 = args.name, args.v1, args.v2
    if not name or not v1 or not v2:
        print(f"  {_red(CROSS)} Missing arguments.", file=sys.stderr)
        print("  Usage: promptschema diff <name> <v1> <v2>")
        sys.exit(1)

    path = os.path.join(os.getcwd(), DEFAULT_REGISTRY_PATH)
    registry = read_registry(path)
    entry = get_prompt_entry(registry, name)
    if not entry:
        print(f"  {_red(CROSS)} Prompt \"{name}\" not found in registry.", file=sys.stderr)
        sys.exit(1)

    try:
        diff = diff_prompt_versions(registry, name, v1, v2)
        output = format_diff(diff)
        print()
        print(output)
    except Exception as exc:
        print(f"  {_red(CROSS)} {exc}", file=sys.stderr)
        sys.exit(1)


def cmd_history(args: argparse.Namespace) -> None:
    name = args.name
    if not name:
        print(f"  {_red(CROSS)} Missing prompt name.", file=sys.stderr)
        print("  Usage: promptschema history <name>")
        sys.exit(1)

    path = os.path.join(os.getcwd(), DEFAULT_REGISTRY_PATH)
    registry = read_registry(path)
    entry = get_prompt_entry(registry, name)
    if not entry:
        print(f"  {_red(CROSS)} Prompt \"{name}\" not found in registry.", file=sys.stderr)
        sys.exit(1)

    history = entry.get("history", [])
    if not history:
        print(f"  {_dim('No version history for')} {name}")
        return

    print()
    print(f"  {_bold(name)} — version history")
    print()
    for h in history:
        date = h.get("createdAt", "")[:10] or "-"
        author = h.get("author", "-")
        changelog = h.get("changelog", "-")
        breaking = f"  {_yellow(f'{WARN} breaking')}" if h.get("breaking") else ""
        print(f"  v{h['version']}   {date}   {author}   {changelog}{breaking}")


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="promptschema",
        description="promptschema — typed, versioned prompts for LLMs",
    )
    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("init", help="Create promptschema.registry.json")
    subparsers.add_parser("list", help="List all registered prompts")
    subparsers.add_parser("status", help="Show sync state of all prompts")
    subparsers.add_parser("validate", help="CI gate — exit 1 if prompts are unsynced")

    bump_parser = subparsers.add_parser("bump", help="Bump a prompt version")
    bump_parser.add_argument("name", help="Prompt name")
    bump_parser.add_argument("--patch", action="store_true")
    bump_parser.add_argument("--minor", action="store_true")
    bump_parser.add_argument("--major", action="store_true")

    diff_parser = subparsers.add_parser("diff", help="Show diff between two versions")
    diff_parser.add_argument("name", help="Prompt name")
    diff_parser.add_argument("v1", help="From version")
    diff_parser.add_argument("v2", help="To version")

    history_parser = subparsers.add_parser("history", help="Show version history")
    history_parser.add_argument("name", help="Prompt name")

    parsed = parser.parse_args()

    commands = {
        "init": cmd_init,
        "list": cmd_list,
        "status": cmd_status,
        "validate": cmd_validate,
        "bump": cmd_bump,
        "diff": cmd_diff,
        "history": cmd_history,
    }

    handler = commands.get(parsed.command)
    if not handler:
        parser.print_help()
        return
    handler(parsed)


if __name__ == "__main__":
    main()
