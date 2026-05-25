import type { ZodType, infer as ZodInfer } from 'zod'
import type { PromptDefinition, PromptInstance, PromptResult, RunOptions } from './types.js'
import { LLMSchemaValidationError, LLMSchemaRunError, type ValidationIssue } from './errors.js'
import { validateInput } from './schema.js'

const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
const SEMVER_RE = /^\d+\.\d+\.\d+$/
const MODEL_RE = /^[a-z]+\/.+$/

function validateConfig(config: PromptDefinition<unknown>): void {
  const issues: ValidationIssue[] = []

  if (!config.name || !KEBAB_CASE_RE.test(config.name)) {
    issues.push({
      field: 'name',
      message: 'must be non-empty kebab-case (e.g. "order-assistant")',
      received: config.name,
    })
  }

  if (!config.version || !SEMVER_RE.test(config.version)) {
    issues.push({
      field: 'version',
      message: 'must be valid semver (e.g. "1.0.0")',
      received: config.version,
    })
  }

  if (!config.model || !MODEL_RE.test(config.model)) {
    issues.push({
      field: 'model',
      message: 'must be in "provider/model" format (e.g. "openai/gpt-4o")',
      received: config.model,
    })
  }

  if (issues.length > 0) {
    throw new LLMSchemaValidationError(
      config.name || '(unnamed)',
      config.version || '(no version)',
      issues,
    )
  }
}

function normalizeTemplateOutput(raw: string): string {
  return raw
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.replace(/^[ \t]+/, ''))
    .join('\n')
    .trim()
}

export function definePrompt<TInput>(
  config: PromptDefinition<TInput>,
): PromptInstance<TInput> {
  validateConfig(config as PromptDefinition<unknown>)

  const { name, version, model, input, template } = config

  function validate(rawInput: unknown): TInput {
    return validateInput(input, rawInput, name, version)
  }

  function render(rawInput: TInput): string {
    const validated = validate(rawInput)
    const raw = template(validated)
    return normalizeTemplateOutput(raw)
  }

  async function run(_input: TInput, _options?: RunOptions): Promise<PromptResult> {
    validate(_input)
    throw new LLMSchemaRunError(
      name,
      model,
      `runner not initialized — adapters will be available in a future version`,
    )
  }

  return Object.freeze({
    name,
    version,
    model,
    validate,
    render,
    run,
  })
}
