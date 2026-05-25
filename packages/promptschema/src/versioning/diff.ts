import { LLMSchemaError } from '../errors.js'
import type { Registry, RegistryHistoryEntry } from './registry-types.js'
import { getPromptEntry, getHistoryEntry } from './registry.js'

export interface SchemaDiff {
  added: Array<{ field: string; type: string; optional: boolean }>
  removed: Array<{ field: string; type: string }>
  typeChanged: Array<{ field: string; from: string; to: string }>
  unchanged: boolean
}

export interface HistorySummary {
  version: string
  author: string
  createdAt: string
  changelog: string
  breaking: boolean
}

export interface PromptDiff {
  promptName: string
  fromVersion: string
  toVersion: string
  schema: SchemaDiff
  templateChanged: boolean
  modelChange: { from: string; to: string } | null
  history: HistorySummary[]
}

interface JsonSchemaProps {
  properties?: Record<string, { type?: string; [k: string]: unknown }>
  required?: string[]
}

function buildSchemaDiff(
  fromSchema: Record<string, unknown>,
  toSchema: Record<string, unknown>,
): SchemaDiff {
  const fromProps = ((fromSchema as JsonSchemaProps).properties || {}) as Record<string, { type?: string }>
  const toProps = ((toSchema as JsonSchemaProps).properties || {}) as Record<string, { type?: string }>
  const toRequired = new Set(((toSchema as JsonSchemaProps).required || []) as string[])

  const fromKeys = new Set(Object.keys(fromProps))
  const toKeys = new Set(Object.keys(toProps))

  const added: SchemaDiff['added'] = []
  const removed: SchemaDiff['removed'] = []
  const typeChanged: SchemaDiff['typeChanged'] = []

  for (const key of toKeys) {
    if (!fromKeys.has(key)) {
      added.push({ field: key, type: toProps[key]?.type || 'unknown', optional: !toRequired.has(key) })
    }
  }

  for (const key of fromKeys) {
    if (!toKeys.has(key)) {
      removed.push({ field: key, type: fromProps[key]?.type || 'unknown' })
    }
  }

  for (const key of fromKeys) {
    if (toKeys.has(key)) {
      const fromType = fromProps[key]?.type || 'unknown'
      const toType = toProps[key]?.type || 'unknown'
      if (fromType !== toType) {
        typeChanged.push({ field: key, from: fromType, to: toType })
      }
    }
  }

  const unchanged = added.length === 0 && removed.length === 0 && typeChanged.length === 0

  return { added, removed, typeChanged, unchanged }
}

function collectHistory(
  history: RegistryHistoryEntry[],
  fromVersion: string,
  toVersion: string,
): HistorySummary[] {
  const fromIdx = history.findIndex((h) => h.version === fromVersion)
  const toIdx = history.findIndex((h) => h.version === toVersion)

  if (fromIdx === -1 || toIdx === -1) return []

  const startIdx = Math.min(fromIdx, toIdx)
  const endIdx = Math.max(fromIdx, toIdx)

  return history.slice(startIdx, endIdx + 1).map((h) => ({
    version: h.version,
    author: h.author,
    createdAt: h.createdAt,
    changelog: h.changelog,
    breaking: h.breaking,
  }))
}

export function diffPromptVersions(
  registry: Registry,
  promptName: string,
  fromVersion: string,
  toVersion: string,
): PromptDiff {
  const promptEntry = getPromptEntry(registry, promptName)
  if (!promptEntry) {
    throw new LLMSchemaError(`prompt '${promptName}' not found in registry`)
  }

  const fromEntry = getHistoryEntry(registry, promptName, fromVersion)
  if (!fromEntry) {
    throw new LLMSchemaError(`version '${fromVersion}' not found for prompt '${promptName}'`)
  }

  const toEntry = getHistoryEntry(registry, promptName, toVersion)
  if (!toEntry) {
    throw new LLMSchemaError(`version '${toVersion}' not found for prompt '${promptName}'`)
  }

  const schema = buildSchemaDiff(fromEntry.schema, toEntry.schema)
  const templateChanged = fromEntry.templateHash !== toEntry.templateHash
  const modelChange = fromEntry.model !== toEntry.model
    ? { from: fromEntry.model, to: toEntry.model }
    : null

  const history = collectHistory(promptEntry.history, fromVersion, toVersion)

  return {
    promptName,
    fromVersion,
    toVersion,
    schema,
    templateChanged,
    modelChange,
    history,
  }
}

export function formatDiff(diff: PromptDiff): string {
  const lines: string[] = []

  lines.push(`prompt:  ${diff.promptName}`)
  lines.push(`diff:    v${diff.fromVersion} → v${diff.toVersion}`)
  lines.push('')

  lines.push('schema')
  if (diff.schema.unchanged) {
    lines.push('  (no changes)')
  } else {
    for (const f of diff.schema.added) {
      lines.push(`  + ${f.field}: ${f.type}${f.optional ? ' (optional)' : ''}`)
    }
    for (const f of diff.schema.removed) {
      lines.push(`  - ${f.field}: ${f.type}`)
    }
    for (const f of diff.schema.typeChanged) {
      lines.push(`  ~ ${f.field}: ${f.from} → ${f.to}`)
    }
  }
  lines.push('')

  lines.push('template')
  lines.push(diff.templateChanged ? '  modified' : '  (no changes)')
  lines.push('')

  lines.push('model')
  if (diff.modelChange) {
    lines.push(`  ${diff.modelChange.from} → ${diff.modelChange.to}`)
  } else {
    lines.push('  (no changes)')
  }

  if (diff.history.length > 0) {
    lines.push('')
    lines.push('history')
    for (const h of diff.history) {
      const breaking = h.breaking ? '  ⚠ breaking' : ''
      lines.push(`  v${h.version}  ${h.author}  ${h.changelog}${breaking}`)
    }
  }

  return lines.join('\n')
}
