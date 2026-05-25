import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { loadFromRegistry } from '../../src/load-from-registry.js'
import { LLMSchemaError, LLMSchemaValidationError } from '../../src/errors.js'
import type { Registry } from '../../src/versioning/registry-types.js'

function tmpFile(): string {
  return join(tmpdir(), `test-registry-${randomBytes(4).toString('hex')}.json`)
}

function makeRegistry(): Registry {
  return {
    $schema: 'https://promptschema.dev/registry.schema.json',
    version: '1',
    prompts: {
      'order-assistant': {
        current: '2.0.0',
        history: [
          {
            version: '2.0.0',
            createdAt: '2026-05-25T10:00:00Z',
            author: 'test',
            templateHash: 'abc123',
            schemaHash: 'def456',
            model: 'openai/gpt-4o',
            changelog: 'added discount field',
            breaking: false,
            schema: {
              type: 'object',
              properties: {
                order: { type: 'string' },
                lang: { enum: ['es', 'en'] },
                total: { type: 'number', exclusiveMinimum: 0 },
                discount: { type: 'boolean' },
              },
              required: ['order', 'lang', 'total'],
            },
          },
          {
            version: '1.0.0',
            createdAt: '2026-03-01T09:00:00Z',
            author: 'test',
            templateHash: 'xyz789',
            schemaHash: 'uvw321',
            model: 'openai/gpt-3.5-turbo',
            changelog: 'initial version',
            breaking: false,
            schema: {
              type: 'object',
              properties: {
                order: { type: 'string' },
                lang: { enum: ['es', 'en'] },
              },
              required: ['order', 'lang'],
            },
          },
        ],
      },
    },
  }
}

describe('loadFromRegistry', () => {
  let registryPath: string

  beforeEach(() => {
    registryPath = tmpFile()
    writeFileSync(registryPath, JSON.stringify(makeRegistry(), null, 2))
  })

  afterEach(() => {
    if (existsSync(registryPath)) unlinkSync(registryPath)
  })

  it('loads a prompt and returns a valid PromptInstance', () => {
    const prompt = loadFromRegistry('order-assistant', { registryPath })

    expect(prompt.name).toBe('order-assistant')
    expect(prompt.version).toBe('2.0.0')
    expect(prompt.model).toBe('openai/gpt-4o')
    expect(typeof prompt.validate).toBe('function')
    expect(typeof prompt.render).toBe('function')
    expect(typeof prompt.run).toBe('function')
  })

  it('validates inputs correctly — accepts valid input', () => {
    const prompt = loadFromRegistry('order-assistant', { registryPath })
    const result = prompt.validate({ order: 'Dress', lang: 'en', total: 149 })

    expect(result).toEqual({ order: 'Dress', lang: 'en', total: 149 })
  })

  it('validates inputs correctly — accepts with optional field', () => {
    const prompt = loadFromRegistry('order-assistant', { registryPath })
    const result = prompt.validate({ order: 'Dress', lang: 'es', total: 50, discount: true })

    expect(result).toEqual({ order: 'Dress', lang: 'es', total: 50, discount: true })
  })

  it('rejects invalid inputs', () => {
    const prompt = loadFromRegistry('order-assistant', { registryPath })

    expect(() => prompt.validate({ order: 'Dress' })).toThrow(LLMSchemaValidationError)
  })

  it('rejects invalid enum values', () => {
    const prompt = loadFromRegistry('order-assistant', { registryPath })

    expect(() =>
      prompt.validate({ order: 'Dress', lang: 'fr', total: 10 }),
    ).toThrow(LLMSchemaValidationError)
  })

  it('renders input as JSON string', () => {
    const prompt = loadFromRegistry('order-assistant', { registryPath })
    const rendered = prompt.render({ order: 'Dress', lang: 'en', total: 149 })

    const parsed = JSON.parse(rendered)
    expect(parsed.order).toBe('Dress')
    expect(parsed.lang).toBe('en')
    expect(parsed.total).toBe(149)
  })

  it('loads a specific version', () => {
    const prompt = loadFromRegistry('order-assistant', {
      registryPath,
      version: '1.0.0',
    })

    expect(prompt.version).toBe('1.0.0')
    expect(prompt.model).toBe('openai/gpt-3.5-turbo')
    expect(prompt.validate({ order: 'Dress', lang: 'en' })).toEqual({
      order: 'Dress',
      lang: 'en',
    })
  })

  it('throws if prompt not found', () => {
    expect(() =>
      loadFromRegistry('nonexistent', { registryPath }),
    ).toThrow(LLMSchemaError)
  })

  it('throws if version not found', () => {
    expect(() =>
      loadFromRegistry('order-assistant', { registryPath, version: '9.9.9' }),
    ).toThrow(LLMSchemaError)
  })

  it('throws if schema field is missing', () => {
    const reg = makeRegistry()
    reg.prompts['order-assistant'].history[0].schema = {}
    writeFileSync(registryPath, JSON.stringify(reg))

    expect(() =>
      loadFromRegistry('order-assistant', { registryPath }),
    ).toThrow(LLMSchemaError)
  })

  it('returned instance is frozen', () => {
    const prompt = loadFromRegistry('order-assistant', { registryPath })
    expect(Object.isFrozen(prompt)).toBe(true)
  })
})
