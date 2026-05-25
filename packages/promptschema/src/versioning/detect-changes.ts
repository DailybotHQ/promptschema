import type { ZodType } from 'zod'
import type { RegistryHistoryEntry, ChangeDetail, BumpType } from './registry-types.js'
import { hashTemplate, hashSchema } from './hash.js'
import { schemaToJsonSchema } from '../schema.js'

interface JsonSchemaObject {
  type?: string
  properties?: Record<string, { type?: string; [k: string]: unknown }>
  required?: string[]
  [k: string]: unknown
}

function diffJsonSchemas(
  oldSchema: Record<string, unknown>,
  newSchema: Record<string, unknown>,
): { added: string[]; removed: string[]; typeChanged: string[]; addedRequired: string[] } {
  const oldProps = ((oldSchema as JsonSchemaObject).properties || {}) as Record<string, { type?: string }>
  const newProps = ((newSchema as JsonSchemaObject).properties || {}) as Record<string, { type?: string }>
  const newRequired = new Set(((newSchema as JsonSchemaObject).required || []) as string[])

  const oldKeys = new Set(Object.keys(oldProps))
  const newKeys = new Set(Object.keys(newProps))

  const added: string[] = []
  const addedRequired: string[] = []
  const removed: string[] = []
  const typeChanged: string[] = []

  for (const key of newKeys) {
    if (!oldKeys.has(key)) {
      added.push(key)
      if (newRequired.has(key)) {
        addedRequired.push(key)
      }
    }
  }

  for (const key of oldKeys) {
    if (!newKeys.has(key)) {
      removed.push(key)
    }
  }

  for (const key of oldKeys) {
    if (newKeys.has(key) && oldProps[key]?.type !== newProps[key]?.type) {
      typeChanged.push(key)
    }
  }

  return { added, removed, typeChanged, addedRequired }
}

export function detectChanges(
  templateFn: (...args: unknown[]) => string,
  inputSchema: ZodType,
  model: string,
  registryEntry: RegistryHistoryEntry,
): ChangeDetail {
  const currentTemplateHash = hashTemplate(templateFn)
  const currentSchemaHash = hashSchema(inputSchema)

  const templateChanged = currentTemplateHash !== registryEntry.templateHash
  const schemaChanged = currentSchemaHash !== registryEntry.schemaHash
  const modelChanged = model !== registryEntry.model

  let fieldsAdded: string[] = []
  let fieldsRemoved: string[] = []
  let fieldsTypeChanged: string[] = []
  let hasBreakingSchemaChange = false

  if (schemaChanged) {
    const currentJsonSchema = schemaToJsonSchema(inputSchema) as Record<string, unknown>
    const diff = diffJsonSchemas(registryEntry.schema, currentJsonSchema)
    fieldsAdded = diff.added
    fieldsRemoved = diff.removed
    fieldsTypeChanged = diff.typeChanged
    hasBreakingSchemaChange = diff.removed.length > 0 || diff.typeChanged.length > 0 || diff.addedRequired.length > 0
  }

  const suggestedBump = suggestBump({
    templateChanged,
    schemaChanged,
    modelChanged,
    fieldsAdded,
    fieldsRemoved,
    fieldsTypeChanged,
    hasBreakingSchemaChange,
  })

  return {
    templateChanged,
    schemaChanged,
    modelChanged,
    fieldsAdded,
    fieldsRemoved,
    fieldsTypeChanged,
    suggestedBump,
  }
}

function suggestBump(info: {
  templateChanged: boolean
  schemaChanged: boolean
  modelChanged: boolean
  fieldsAdded: string[]
  fieldsRemoved: string[]
  fieldsTypeChanged: string[]
  hasBreakingSchemaChange: boolean
}): BumpType | null {
  if (info.fieldsRemoved.length > 0 || info.fieldsTypeChanged.length > 0 || info.hasBreakingSchemaChange) {
    return 'major'
  }

  if (info.fieldsAdded.length > 0 || info.modelChanged) {
    return 'minor'
  }

  if (info.templateChanged) {
    return 'patch'
  }

  return null
}
