import type { PromptInstance, PromptResult, RunOptions } from './types.js'
import { LLMSchemaError } from './errors.js'
import { readRegistry, getPromptEntry, getHistoryEntry } from './versioning/registry.js'
import { DEFAULT_REGISTRY_PATH } from './versioning/registry.js'
import { jsonSchemaToZod } from './json-schema-to-zod.js'
import { validateInput } from './schema.js'
import { runPrompt } from './runner.js'

export interface LoadOptions {
  registryPath?: string
  version?: string
}

export function loadFromRegistry(
  name: string,
  options: LoadOptions = {},
): PromptInstance<Record<string, unknown>> {
  const registryPath = options.registryPath ?? DEFAULT_REGISTRY_PATH
  const registry = readRegistry(registryPath)

  const entry = getPromptEntry(registry, name)
  if (!entry) {
    throw new LLMSchemaError(`prompt "${name}" not found in registry at "${registryPath}"`)
  }

  const targetVersion = options.version ?? entry.current
  const historyEntry = getHistoryEntry(registry, name, targetVersion)
  if (!historyEntry) {
    throw new LLMSchemaError(
      `version "${targetVersion}" not found for prompt "${name}" in registry`,
    )
  }

  if (!historyEntry.schema || Object.keys(historyEntry.schema).length === 0) {
    throw new LLMSchemaError(
      `prompt "${name}" v${targetVersion} has no schema in registry — cannot reconstruct validation`,
    )
  }

  const zodSchema = jsonSchemaToZod(historyEntry.schema)
  const { version, model } = historyEntry

  function validate(rawInput: unknown): Record<string, unknown> {
    return validateInput(zodSchema, rawInput, name, version) as Record<string, unknown>
  }

  function render(rawInput: Record<string, unknown>): string {
    const validated = validate(rawInput)
    return JSON.stringify(validated, null, 2)
  }

  async function run(
    rawInput: Record<string, unknown>,
    runOptions?: RunOptions,
  ): Promise<PromptResult> {
    return runPrompt(
      {
        name,
        version,
        model: runOptions?.model ?? model,
        input: zodSchema,
        template: (input: unknown) => JSON.stringify(input, null, 2),
      },
      rawInput,
      runOptions,
    )
  }

  return Object.freeze({ name, version, model, validate, render, run })
}
