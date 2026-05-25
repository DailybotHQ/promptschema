import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { detectChanges } from '../../src/versioning/detect-changes.js'
import { hashTemplate, hashSchema } from '../../src/versioning/hash.js'
import { schemaToJsonSchema } from '../../src/schema.js'
import type { RegistryHistoryEntry } from '../../src/versioning/registry-types.js'

function makeEntry(overrides: Partial<RegistryHistoryEntry> = {}): RegistryHistoryEntry {
  const schema = z.object({ order: z.string(), total: z.number() })
  const templateFn = (i: { order: string; total: number }) => `Order: ${i.order}, Total: ${i.total}`

  return {
    version: '1.0.0',
    createdAt: '2026-01-01T00:00:00Z',
    author: 'oscar',
    templateHash: hashTemplate(templateFn as (...args: unknown[]) => string),
    schemaHash: hashSchema(schema),
    model: 'openai/gpt-4o',
    changelog: 'initial',
    breaking: false,
    schema: schemaToJsonSchema(schema) as Record<string, unknown>,
    ...overrides,
  }
}

describe('detectChanges', () => {
  const baseTemplate = (i: { order: string; total: number }) => `Order: ${i.order}, Total: ${i.total}`
  const baseSchema = z.object({ order: z.string(), total: z.number() })

  it('returns null suggestedBump when nothing changed', () => {
    const entry = makeEntry()
    const changes = detectChanges(baseTemplate as (...args: unknown[]) => string, baseSchema, 'openai/gpt-4o', entry)
    expect(changes.suggestedBump).toBeNull()
    expect(changes.templateChanged).toBe(false)
    expect(changes.schemaChanged).toBe(false)
    expect(changes.modelChanged).toBe(false)
  })

  it('suggests patch when only template changed', () => {
    const entry = makeEntry()
    const newTemplate = (i: { order: string; total: number }) => `New Order: ${i.order}`
    const changes = detectChanges(newTemplate as (...args: unknown[]) => string, baseSchema, 'openai/gpt-4o', entry)
    expect(changes.suggestedBump).toBe('patch')
    expect(changes.templateChanged).toBe(true)
    expect(changes.schemaChanged).toBe(false)
  })

  it('suggests minor when optional field added', () => {
    const entry = makeEntry()
    const newSchema = z.object({ order: z.string(), total: z.number(), discount: z.boolean().optional() })
    const changes = detectChanges(baseTemplate as (...args: unknown[]) => string, newSchema, 'openai/gpt-4o', entry)
    expect(changes.suggestedBump).toBe('minor')
    expect(changes.fieldsAdded).toContain('discount')
  })

  it('suggests major when required field added', () => {
    const entry = makeEntry()
    const newSchema = z.object({ order: z.string(), total: z.number(), lang: z.string() })
    const changes = detectChanges(baseTemplate as (...args: unknown[]) => string, newSchema, 'openai/gpt-4o', entry)
    expect(changes.suggestedBump).toBe('major')
    expect(changes.fieldsAdded).toContain('lang')
  })

  it('suggests major when field removed', () => {
    const entry = makeEntry()
    const newSchema = z.object({ order: z.string() })
    const changes = detectChanges(baseTemplate as (...args: unknown[]) => string, newSchema, 'openai/gpt-4o', entry)
    expect(changes.suggestedBump).toBe('major')
    expect(changes.fieldsRemoved).toContain('total')
  })

  it('suggests major when field type changed', () => {
    const entry = makeEntry()
    const newSchema = z.object({ order: z.string(), total: z.string() })
    const changes = detectChanges(baseTemplate as (...args: unknown[]) => string, newSchema, 'openai/gpt-4o', entry)
    expect(changes.suggestedBump).toBe('major')
    expect(changes.fieldsTypeChanged).toContain('total')
  })

  it('suggests minor when model changed', () => {
    const entry = makeEntry()
    const changes = detectChanges(baseTemplate as (...args: unknown[]) => string, baseSchema, 'openai/gpt-4o-mini', entry)
    expect(changes.suggestedBump).toBe('minor')
    expect(changes.modelChanged).toBe(true)
  })

  it('major wins when multiple changes occur', () => {
    const entry = makeEntry()
    const newTemplate = (i: { order: string }) => `Changed: ${i.order}`
    const newSchema = z.object({ order: z.string() })
    const changes = detectChanges(newTemplate as (...args: unknown[]) => string, newSchema, 'openai/gpt-4o-mini', entry)
    expect(changes.suggestedBump).toBe('major')
    expect(changes.templateChanged).toBe(true)
    expect(changes.modelChanged).toBe(true)
    expect(changes.fieldsRemoved).toContain('total')
  })
})
