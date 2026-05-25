# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `definePrompt()` (TypeScript) and `@define_prompt` (Python) for typed prompt definitions
- Zod (TS) and Pydantic v2 (Python) input validation
- Built-in adapters: OpenAI, Anthropic, Gemini, Ollama
- Custom adapter registration via `registerAdapter()` / `register_adapter()`
- Semantic versioning system with `promptschema.registry.json`
- Change detection with automatic bump suggestions
- Human-readable diffs between prompt versions
- CLI with `init`, `status`, `bump`, `diff`, `validate`, `list`, `history` commands
- Cross-language parity (TypeScript ↔ Python share the same registry format)
- Cost estimation for supported models
- `loadFromRegistry()` (TS) and `load_from_registry()` (Python) for runtime prompt loading from the registry
- JSON Schema → Zod converter for reconstructing typed schemas at runtime
- JSON Schema → dynamic Pydantic model converter with `anyOf` support
- Cross-language round-trip tests using a shared fixture registry
- Integration tests for all LLM adapters with real API calls
- ESLint 9 flat config with `typescript-eslint` and `eslint-config-prettier`
- Bundle size-check GitHub Actions workflow (75kb/file, 150kb total thresholds)
- `CONTRIBUTING.md` with setup guide, workflow, and PR checklist
