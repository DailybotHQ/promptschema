import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { LLMSchemaError } from '../errors.js'
import type { Registry, RegistryPromptEntry, RegistryHistoryEntry } from './registry-types.js'

export const REGISTRY_SCHEMA_URL = 'https://promptschema.dev/registry.schema.json'
export const DEFAULT_REGISTRY_PATH = 'promptschema.registry.json'

export function createEmptyRegistry(): Registry {
  return {
    $schema: REGISTRY_SCHEMA_URL,
    version: '1',
    prompts: {},
  }
}

export function readRegistry(filePath: string = DEFAULT_REGISTRY_PATH): Registry {
  if (!existsSync(filePath)) {
    return createEmptyRegistry()
  }

  const raw = readFileSync(filePath, 'utf8')

  try {
    const parsed = JSON.parse(raw) as Registry
    return parsed
  } catch {
    throw new LLMSchemaError(
      `failed to parse registry at '${filePath}' — file contains invalid JSON`,
    )
  }
}

export function writeRegistry(filePath: string, registry: Registry): void {
  const dir = dirname(filePath)
  if (dir && dir !== '.' && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const content = JSON.stringify(registry, null, 2) + '\n'
  const tmpPath = join(dir || '.', `.registry-${randomBytes(4).toString('hex')}.tmp`)

  writeFileSync(tmpPath, content, 'utf8')
  renameSync(tmpPath, filePath)
}

export function getPromptEntry(
  registry: Registry,
  promptName: string,
): RegistryPromptEntry | undefined {
  return registry.prompts[promptName]
}

export function getHistoryEntry(
  registry: Registry,
  promptName: string,
  version: string,
): RegistryHistoryEntry | undefined {
  const prompt = registry.prompts[promptName]
  if (!prompt) return undefined
  return prompt.history.find((h) => h.version === version)
}
