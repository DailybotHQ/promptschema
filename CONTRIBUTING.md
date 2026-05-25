# Contributing to promptschema

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Prerequisites

- **Node.js** >= 18
- **pnpm** (install via `corepack enable` or `npm i -g pnpm`)
- **Python** >= 3.10 (only needed if working on the Python package)

## Setup

```bash
git clone https://github.com/tuusuario/promptschema.git
cd promptschema
pnpm install
pnpm build
pnpm test
```

For the Python package:

```bash
cd packages/promptschema-python
pip install -e ".[dev]"
pytest
```

## Project Structure

```
packages/
  promptschema/              # TypeScript package (npm)
  promptschema-python/       # Python package (PyPI)
examples/
  typescript/                # TS usage examples
  python/                    # Python usage examples
```

## Development Workflow

1. **Branch from main:**

   ```bash
   git checkout main && git pull
   git checkout -b feat/my-feature
   ```

2. **Make your changes** in the relevant package.

3. **Run checks:**

   ```bash
   pnpm build        # Build the TS package
   pnpm lint         # ESLint
   pnpm typecheck    # TypeScript type checking
   pnpm test         # Unit tests (196 TS + 67 Python)
   ```

4. **Commit with [conventional commits](https://www.conventionalcommits.org/):**

   ```
   feat: add support for streaming responses
   fix: handle empty template output
   chore: update dependencies
   refactor: simplify adapter registry
   test: add edge case for versioning
   docs: update API examples
   ```

5. **Push and open a PR** against `main`.

## Testing

| Command | What it runs |
|---|---|
| `pnpm test` | Unit tests (TS + Python via turbo) |
| `pnpm test:integration` | Real API calls (requires API keys) |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm lint` | ESLint |

**Integration tests** require API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`). They are completely optional for contributors — unit tests cover all functionality with mocks.

**Cross-language parity tests** verify that TypeScript and Python produce identical JSON Schema for the same prompt definitions.

## Code Style

- **TypeScript:** ESLint + Prettier, strict mode, type annotations required
- **Python:** Type hints, Pydantic v2 conventions
- **Comments:** Only explain non-obvious intent or trade-offs — no narrating comments
- **Imports:** Use `type` imports for types-only (`import type { ... }`)

## PR Checklist

Before submitting your PR, make sure:

- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] No new TypeScript `any` types without justification
- [ ] CHANGELOG.md updated (for user-facing changes)
- [ ] Tests added for new functionality

## First-Time Contributors

Look for issues labeled [`good first issue`](https://github.com/tuusuario/promptschema/labels/good%20first%20issue) — these are scoped, well-documented tasks designed for newcomers.

## Questions?

Open an issue or start a discussion. We're happy to help!
