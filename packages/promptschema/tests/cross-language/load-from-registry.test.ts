import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { execSync } from 'node:child_process'
import { definePrompt } from '../../src/define-prompt.js'
import { schemaToJsonSchema } from '../../src/schema.js'
import { loadFromRegistry } from '../../src/load-from-registry.js'
import { LLMSchemaValidationError } from '../../src/errors.js'
import { z } from 'zod'
import type { Registry } from '../../src/versioning/registry-types.js'

const FIXTURE_PATH = join(__dirname, 'fixtures', 'test-registry.json')

function tmpFile(): string {
  return join(tmpdir(), `cross-lang-${randomBytes(4).toString('hex')}.json`)
}

describe('loadFromRegistry — cross-language round-trip', () => {
  describe('TS define → registry → TS load', () => {
    let registryPath: string

    beforeEach(() => {
      registryPath = tmpFile()

      const prompt = definePrompt({
        name: 'round-trip-test',
        version: '1.0.0',
        model: 'openai/gpt-4o-mini',
        input: z.object({
          order: z.string(),
          lang: z.enum(['es', 'en']),
          total: z.number(),
          discount: z.boolean().optional(),
        }),
        template: (i) => `Order: ${i.order}`,
      })

      const jsonSchema = schemaToJsonSchema(
        z.object({
          order: z.string(),
          lang: z.enum(['es', 'en']),
          total: z.number(),
          discount: z.boolean().optional(),
        }),
      )

      const registry: Registry = {
        $schema: 'https://promptschema.dev/registry.schema.json',
        version: '1',
        prompts: {
          'round-trip-test': {
            current: '1.0.0',
            history: [
              {
                version: '1.0.0',
                createdAt: new Date().toISOString(),
                author: 'test',
                templateHash: 'aabb',
                schemaHash: 'ccdd',
                model: 'openai/gpt-4o-mini',
                changelog: 'test',
                breaking: false,
                schema: jsonSchema as Record<string, unknown>,
              },
            ],
          },
        },
      }

      writeFileSync(registryPath, JSON.stringify(registry, null, 2))
    })

    afterEach(() => {
      if (existsSync(registryPath)) unlinkSync(registryPath)
    })

    it('loaded prompt validates valid input', () => {
      const loaded = loadFromRegistry('round-trip-test', { registryPath })

      expect(loaded.name).toBe('round-trip-test')
      expect(loaded.version).toBe('1.0.0')
      expect(loaded.model).toBe('openai/gpt-4o-mini')

      const result = loaded.validate({ order: 'Dress', lang: 'en', total: 149 })
      expect(result.order).toBe('Dress')
    })

    it('loaded prompt rejects invalid input', () => {
      const loaded = loadFromRegistry('round-trip-test', { registryPath })

      expect(() => loaded.validate({ order: 'Dress' })).toThrow(LLMSchemaValidationError)
    })

    it('loaded prompt rejects invalid enum', () => {
      const loaded = loadFromRegistry('round-trip-test', { registryPath })

      expect(() =>
        loaded.validate({ order: 'Dress', lang: 'fr', total: 10 }),
      ).toThrow(LLMSchemaValidationError)
    })

    it('loaded prompt accepts optional fields', () => {
      const loaded = loadFromRegistry('round-trip-test', { registryPath })

      const result = loaded.validate({
        order: 'Dress',
        lang: 'es',
        total: 50,
        discount: true,
      })
      expect(result.discount).toBe(true)
    })
  })

  describe('shared fixture registry', () => {
    it('TS loads a prompt from the shared fixture and validates correctly', () => {
      const loaded = loadFromRegistry('order-assistant', { registryPath: FIXTURE_PATH })

      expect(loaded.name).toBe('order-assistant')
      expect(loaded.version).toBe('1.0.0')
      expect(loaded.model).toBe('openai/gpt-4o-mini')

      const valid = loaded.validate({ order: 'Dress', lang: 'en', total: 149 })
      expect(valid.order).toBe('Dress')

      expect(() => loaded.validate({ order: 'Dress' })).toThrow(LLMSchemaValidationError)
      expect(() =>
        loaded.validate({ order: 'Dress', lang: 'fr', total: 10 }),
      ).toThrow(LLMSchemaValidationError)
    })

    it('renders input as JSON', () => {
      const loaded = loadFromRegistry('order-assistant', { registryPath: FIXTURE_PATH })
      const rendered = loaded.render({ order: 'Dress', lang: 'en', total: 149 })

      const parsed = JSON.parse(rendered)
      expect(parsed.order).toBe('Dress')
      expect(parsed.total).toBe(149)
    })
  })
})
