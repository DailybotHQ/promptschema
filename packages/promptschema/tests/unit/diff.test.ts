import { describe, it, expect } from 'vitest'
import { diffPromptVersions, formatDiff } from '../../src/versioning/diff.js'
import { LLMSchemaError } from '../../src/errors.js'
import type { Registry } from '../../src/versioning/registry-types.js'

function makeRegistry(): Registry {
  return {
    $schema: 'https://promptschema.dev/registry.schema.json',
    version: '1',
    prompts: {
      'order-assistant': {
        current: '2.1.0',
        history: [
          {
            version: '2.1.0',
            createdAt: '2026-05-25T10:30:00Z',
            author: 'oscar',
            templateHash: 'aaaa1111',
            schemaHash: 'bbbb2222',
            model: 'openai/gpt-4o',
            changelog: 'added discount field',
            breaking: false,
            schema: {
              type: 'object',
              properties: {
                order: { type: 'string' },
                total: { type: 'number' },
                discount: { type: 'boolean' },
              },
              required: ['order', 'total'],
            },
          },
          {
            version: '2.0.0',
            createdAt: '2026-04-10T08:00:00Z',
            author: 'oscar',
            templateHash: 'cccc3333',
            schemaHash: 'dddd4444',
            model: 'openai/gpt-4o',
            changelog: 'removed currency field',
            breaking: true,
            schema: {
              type: 'object',
              properties: {
                order: { type: 'string' },
                total: { type: 'number' },
              },
              required: ['order', 'total'],
            },
          },
          {
            version: '1.0.0',
            createdAt: '2026-03-01T09:00:00Z',
            author: 'oscar',
            templateHash: 'eeee5555',
            schemaHash: 'ffff6666',
            model: 'openai/gpt-3.5-turbo',
            changelog: 'initial version',
            breaking: false,
            schema: {
              type: 'object',
              properties: {
                order: { type: 'string' },
                total: { type: 'string' },
                currency: { type: 'string' },
              },
              required: ['order', 'total', 'currency'],
            },
          },
        ],
      },
    },
  }
}

describe('diffPromptVersions', () => {
  it('detects added fields', () => {
    const diff = diffPromptVersions(makeRegistry(), 'order-assistant', '2.0.0', '2.1.0')
    expect(diff.schema.added).toEqual([{ field: 'discount', type: 'boolean', optional: true }])
  })

  it('detects removed fields', () => {
    const diff = diffPromptVersions(makeRegistry(), 'order-assistant', '1.0.0', '2.0.0')
    expect(diff.schema.removed.map((f) => f.field)).toContain('currency')
  })

  it('detects type changes', () => {
    const diff = diffPromptVersions(makeRegistry(), 'order-assistant', '1.0.0', '2.0.0')
    expect(diff.schema.typeChanged.map((f) => f.field)).toContain('total')
    expect(diff.schema.typeChanged.find((f) => f.field === 'total')).toEqual({
      field: 'total',
      from: 'string',
      to: 'number',
    })
  })

  it('detects template hash change', () => {
    const diff = diffPromptVersions(makeRegistry(), 'order-assistant', '1.0.0', '2.0.0')
    expect(diff.templateChanged).toBe(true)
  })

  it('detects no template change when hashes match', () => {
    const reg = makeRegistry()
    reg.prompts['order-assistant']!.history[0]!.templateHash = 'cccc3333'
    const diff = diffPromptVersions(reg, 'order-assistant', '2.0.0', '2.1.0')
    expect(diff.templateChanged).toBe(false)
  })

  it('detects model change', () => {
    const diff = diffPromptVersions(makeRegistry(), 'order-assistant', '1.0.0', '2.0.0')
    expect(diff.modelChange).toEqual({ from: 'openai/gpt-3.5-turbo', to: 'openai/gpt-4o' })
  })

  it('returns null modelChange when model unchanged', () => {
    const diff = diffPromptVersions(makeRegistry(), 'order-assistant', '2.0.0', '2.1.0')
    expect(diff.modelChange).toBeNull()
  })

  it('collects history between versions', () => {
    const diff = diffPromptVersions(makeRegistry(), 'order-assistant', '1.0.0', '2.1.0')
    expect(diff.history.length).toBe(3)
    expect(diff.history.map((h) => h.version)).toEqual(['2.1.0', '2.0.0', '1.0.0'])
  })

  it('throws for missing prompt', () => {
    expect(() =>
      diffPromptVersions(makeRegistry(), 'nonexistent', '1.0.0', '2.0.0'),
    ).toThrow(LLMSchemaError)
  })

  it('throws for missing from-version', () => {
    expect(() =>
      diffPromptVersions(makeRegistry(), 'order-assistant', '9.9.9', '2.0.0'),
    ).toThrow(LLMSchemaError)
  })

  it('throws for missing to-version', () => {
    expect(() =>
      diffPromptVersions(makeRegistry(), 'order-assistant', '1.0.0', '9.9.9'),
    ).toThrow(LLMSchemaError)
  })
})

describe('formatDiff', () => {
  it('produces readable output with all sections', () => {
    const diff = diffPromptVersions(makeRegistry(), 'order-assistant', '1.0.0', '2.1.0')
    const output = formatDiff(diff)

    expect(output).toContain('prompt:  order-assistant')
    expect(output).toContain('v1.0.0 → v2.1.0')
    expect(output).toContain('schema')
    expect(output).toContain('template')
    expect(output).toContain('model')
    expect(output).toContain('history')
  })

  it('shows added fields with +', () => {
    const diff = diffPromptVersions(makeRegistry(), 'order-assistant', '2.0.0', '2.1.0')
    const output = formatDiff(diff)
    expect(output).toContain('+ discount: boolean (optional)')
  })

  it('shows removed fields with -', () => {
    const diff = diffPromptVersions(makeRegistry(), 'order-assistant', '1.0.0', '2.0.0')
    const output = formatDiff(diff)
    expect(output).toContain('- currency: string')
  })

  it('shows type changes with ~', () => {
    const diff = diffPromptVersions(makeRegistry(), 'order-assistant', '1.0.0', '2.0.0')
    const output = formatDiff(diff)
    expect(output).toContain('~ total: string → number')
  })

  it('shows model change', () => {
    const diff = diffPromptVersions(makeRegistry(), 'order-assistant', '1.0.0', '2.0.0')
    const output = formatDiff(diff)
    expect(output).toContain('openai/gpt-3.5-turbo → openai/gpt-4o')
  })

  it('shows (no changes) when schema is unchanged', () => {
    const reg = makeRegistry()
    reg.prompts['order-assistant']!.history[0]!.schemaHash = reg.prompts['order-assistant']!.history[1]!.schemaHash
    const diff = diffPromptVersions(reg, 'order-assistant', '2.0.0', '2.1.0')
    diff.schema = { added: [], removed: [], typeChanged: [], unchanged: true }
    const output = formatDiff(diff)
    expect(output).toContain('(no changes)')
  })
})
