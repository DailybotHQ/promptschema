import type { ZodType } from 'zod'
import type { Registry, RegistryHistoryEntry, BumpType, ChangeDetail } from './registry-types.js'
import { LLMSchemaError } from '../errors.js'
import { hashTemplate, hashSchema } from './hash.js'
import { schemaToJsonSchema } from '../schema.js'
import { detectChanges } from './detect-changes.js'
import { getPromptEntry } from './registry.js'

export function incrementVersion(current: string, bump: BumpType): string {
  const parts = current.split('.').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new LLMSchemaError(`invalid semver version: '${current}'`)
  }
  const [major, minor, patch] = parts

  switch (bump) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
  }
}

function generateChangelog(changes: ChangeDetail, model: string, oldModel?: string): string {
  const parts: string[] = []

  if (changes.fieldsRemoved.length > 0) {
    parts.push(`removed field${changes.fieldsRemoved.length > 1 ? 's' : ''}: ${changes.fieldsRemoved.join(', ')}`)
  }
  if (changes.fieldsTypeChanged.length > 0) {
    parts.push(`type changed: ${changes.fieldsTypeChanged.join(', ')}`)
  }
  if (changes.fieldsAdded.length > 0) {
    parts.push(`added field${changes.fieldsAdded.length > 1 ? 's' : ''}: ${changes.fieldsAdded.join(', ')}`)
  }
  if (changes.modelChanged && oldModel) {
    parts.push(`model changed from ${oldModel} to ${model}`)
  }
  if (changes.templateChanged) {
    parts.push('template modified')
  }

  return parts.length > 0 ? parts.join(', ') : 'no changes'
}

export interface RegisterOptions {
  author?: string
}

export function registerPrompt(
  registry: Registry,
  prompt: { name: string; version: string; model: string; template: (...args: unknown[]) => string; input: ZodType },
  options: RegisterOptions = {},
): Registry {
  const { name, version, model, template, input } = prompt
  const author = options.author || 'unknown'

  const entry: RegistryHistoryEntry = {
    version,
    createdAt: new Date().toISOString(),
    author,
    templateHash: hashTemplate(template),
    schemaHash: hashSchema(input),
    model,
    changelog: 'initial version',
    breaking: false,
    schema: schemaToJsonSchema(input) as Record<string, unknown>,
  }

  return {
    ...registry,
    prompts: {
      ...registry.prompts,
      [name]: {
        current: version,
        history: [entry],
      },
    },
  }
}

export interface BumpOptions {
  bump?: BumpType
  changelog?: string
  author?: string
}

export function bumpPrompt(
  registry: Registry,
  prompt: { name: string; version: string; model: string; template: (...args: unknown[]) => string; input: ZodType },
  options: BumpOptions = {},
): Registry {
  const { name, model, template, input } = prompt
  const author = options.author || 'unknown'

  const promptEntry = getPromptEntry(registry, name)
  if (!promptEntry) {
    throw new LLMSchemaError(`prompt '${name}' not found in registry — use registerPrompt() first`)
  }

  const latestEntry = promptEntry.history[0]
  if (!latestEntry) {
    throw new LLMSchemaError(`prompt '${name}' has empty history in registry`)
  }

  const changes = detectChanges(template, input, model, latestEntry)

  const bumpType = options.bump || changes.suggestedBump
  if (!bumpType) {
    throw new LLMSchemaError(
      `no changes detected for prompt '${name}' — nothing to bump`,
    )
  }

  const newVersion = incrementVersion(promptEntry.current, bumpType)
  const changelog = options.changelog || generateChangelog(changes, model, latestEntry.model)

  const newEntry: RegistryHistoryEntry = {
    version: newVersion,
    createdAt: new Date().toISOString(),
    author,
    templateHash: hashTemplate(template),
    schemaHash: hashSchema(input),
    model,
    changelog,
    breaking: bumpType === 'major',
    schema: schemaToJsonSchema(input) as Record<string, unknown>,
  }

  return {
    ...registry,
    prompts: {
      ...registry.prompts,
      [name]: {
        current: newVersion,
        history: [newEntry, ...promptEntry.history],
      },
    },
  }
}
