"""
Example — prompt versioning with the registry.

Run:
    python examples/python/versioning.py
"""

from promptschema.versioning import (
    create_registry,
    register_prompt,
    bump_prompt,
    diff_prompt_versions,
    format_diff,
)

# Start with a fresh in-memory registry
registry = create_registry()

# Register a prompt for the first time
registry = register_prompt(registry, {
    "name": "summarizer",
    "version": "1.0.0",
    "template_hash": "abc123",
    "schema_hash": "def456",
})
print("Registered v1.0.0")

# Bump with a template change (minor bump)
registry = bump_prompt(registry, {
    "name": "summarizer",
    "bump_type": "minor",
    "new_template_hash": "abc999",
})
print("Bumped to:", registry["prompts"]["summarizer"]["current"])

# View diff between versions
diff = diff_prompt_versions(registry, "summarizer", "1.0.0", "1.1.0")
if diff:
    print("\nDiff 1.0.0 → 1.1.0:")
    print(format_diff(diff))
