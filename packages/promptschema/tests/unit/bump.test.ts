import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { incrementVersion, registerPrompt, bumpPrompt } from '../../src/versioning/bump.js'
import { createEmptyRegistry } from '../../src/versioning/registry.js'
import { LLMSchemaError } from '../../src/errors.js'

const basePrompt = {
  name: 'test-prompt',
  version: '1.0.0',
  model: 'openai/gpt-4o',
  input: z.object({ order: z.string(), total: z.number() }),
  template: ((i: { order: string; total: number }) => `Order: ${i.order}, Total: ${i.total}`) as (...args: unknown[]) => string,
}

describe('incrementVersion', () => {
  it('increments patch', () => {
    expect(incrementVersion('1.0.0', 'patch')).toBe('1.0.1')
  })

  it('increments minor and resets patch', () => {
    expect(incrementVersion('1.2.3', 'minor')).toBe('1.3.0')
  })

  it('increments major and resets minor+patch', () => {
    expect(incrementVersion('1.2.3', 'major')).toBe('2.0.0')
  })

  it('throws for invalid version string', () => {
    expect(() => incrementVersion('bad', 'patch')).toThrow(LLMSchemaError)
  })
})

describe('registerPrompt', () => {
  it('creates initial entry in registry', () => {
    const registry = createEmptyRegistry()
    const result = registerPrompt(registry, basePrompt, { author: 'oscar' })

    expect(result.prompts['test-prompt']).toBeDefined()
    expect(result.prompts['test-prompt']!.current).toBe('1.0.0')
    expect(result.prompts['test-prompt']!.history).toHaveLength(1)
    expect(result.prompts['test-prompt']!.history[0]!.changelog).toBe('initial version')
    expect(result.prompts['test-prompt']!.history[0]!.breaking).toBe(false)
  })

  it('includes template and schema hashes', () => {
    const result = registerPrompt(createEmptyRegistry(), basePrompt)
    const entry = result.prompts['test-prompt']!.history[0]!
    expect(entry.templateHash).toMatch(/^[0-9a-f]{8}$/)
    expect(entry.schemaHash).toMatch(/^[0-9a-f]{8}$/)
  })

  it('includes serialized JSON Schema', () => {
    const result = registerPrompt(createEmptyRegistry(), basePrompt)
    const entry = result.prompts['test-prompt']!.history[0]!
    expect(entry.schema).toHaveProperty('type', 'object')
    expect(entry.schema).toHaveProperty('properties')
  })

  it('does not mutate input registry', () => {
    const registry = createEmptyRegistry()
    const result = registerPrompt(registry, basePrompt)
    expect(registry.prompts).toEqual({})
    expect(result.prompts['test-prompt']).toBeDefined()
  })
})

describe('bumpPrompt', () => {
  it('auto-detects patch bump for template change', () => {
    let registry = registerPrompt(createEmptyRegistry(), basePrompt)

    const modifiedPrompt = {
      ...basePrompt,
      template: ((i: { order: string; total: number }) => `Modified: ${i.order}`) as (...args: unknown[]) => string,
    }

    registry = bumpPrompt(registry, modifiedPrompt)
    expect(registry.prompts['test-prompt']!.current).toBe('1.0.1')
    expect(registry.prompts['test-prompt']!.history).toHaveLength(2)
    expect(registry.prompts['test-prompt']!.history[0]!.version).toBe('1.0.1')
  })

  it('respects explicit bump override', () => {
    let registry = registerPrompt(createEmptyRegistry(), basePrompt)

    const modifiedPrompt = {
      ...basePrompt,
      template: ((i: { order: string; total: number }) => `Modified: ${i.order}`) as (...args: unknown[]) => string,
    }

    registry = bumpPrompt(registry, modifiedPrompt, { bump: 'major' })
    expect(registry.prompts['test-prompt']!.current).toBe('2.0.0')
  })

  it('sets breaking: true for major bumps', () => {
    let registry = registerPrompt(createEmptyRegistry(), basePrompt)

    const modifiedPrompt = {
      ...basePrompt,
      input: z.object({ order: z.string() }),
      template: ((i: { order: string }) => `Order: ${i.order}`) as (...args: unknown[]) => string,
    }

    registry = bumpPrompt(registry, modifiedPrompt)
    expect(registry.prompts['test-prompt']!.history[0]!.breaking).toBe(true)
  })

  it('throws when no changes and no explicit bump', () => {
    const registry = registerPrompt(createEmptyRegistry(), basePrompt)
    expect(() => bumpPrompt(registry, basePrompt)).toThrow(LLMSchemaError)
    expect(() => bumpPrompt(registry, basePrompt)).toThrow('no changes detected')
  })

  it('throws when prompt not in registry', () => {
    const registry = createEmptyRegistry()
    expect(() => bumpPrompt(registry, basePrompt)).toThrow(LLMSchemaError)
    expect(() => bumpPrompt(registry, basePrompt)).toThrow('not found in registry')
  })

  it('uses custom changelog when provided', () => {
    let registry = registerPrompt(createEmptyRegistry(), basePrompt)

    const modifiedPrompt = {
      ...basePrompt,
      template: ((i: { order: string; total: number }) => `Modified: ${i.order}`) as (...args: unknown[]) => string,
    }

    registry = bumpPrompt(registry, modifiedPrompt, { changelog: 'improved wording' })
    expect(registry.prompts['test-prompt']!.history[0]!.changelog).toBe('improved wording')
  })

  it('does not mutate input registry', () => {
    const registry = registerPrompt(createEmptyRegistry(), basePrompt)
    const originalCurrent = registry.prompts['test-prompt']!.current

    const modifiedPrompt = {
      ...basePrompt,
      template: ((i: { order: string; total: number }) => `Modified: ${i.order}`) as (...args: unknown[]) => string,
    }

    bumpPrompt(registry, modifiedPrompt)
    expect(registry.prompts['test-prompt']!.current).toBe(originalCurrent)
  })

  it('auto-generates changelog describing changes', () => {
    let registry = registerPrompt(createEmptyRegistry(), basePrompt)

    const modifiedPrompt = {
      ...basePrompt,
      model: 'openai/gpt-4o-mini',
    }

    registry = bumpPrompt(registry, modifiedPrompt)
    expect(registry.prompts['test-prompt']!.history[0]!.changelog).toContain('model changed')
  })
})
