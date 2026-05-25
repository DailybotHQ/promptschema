import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { validateInput, schemaToJsonSchema } from '../../src/schema.js'
import { LLMSchemaValidationError } from '../../src/errors.js'

describe('validateInput', () => {
  const schema = z.object({
    order: z.string(),
    lang: z.enum(['es', 'en']),
    total: z.number().positive(),
    discount: z.boolean().optional(),
  })

  it('returns parsed data for valid input', () => {
    const result = validateInput(schema, { order: 'Dress', lang: 'en', total: 100 }, 'test', '1.0.0')
    expect(result).toEqual({ order: 'Dress', lang: 'en', total: 100 })
  })

  it('includes optional fields when provided', () => {
    const result = validateInput(
      schema,
      { order: 'Dress', lang: 'en', total: 100, discount: true },
      'test',
      '1.0.0',
    )
    expect(result.discount).toBe(true)
  })

  it('throws LLMSchemaValidationError for missing required field', () => {
    expect(() =>
      validateInput(schema, { order: 'Dress', lang: 'en' }, 'test', '1.0.0'),
    ).toThrow(LLMSchemaValidationError)
  })

  it('throws for wrong type', () => {
    try {
      validateInput(schema, { order: 'Dress', lang: 'en', total: 'abc' }, 'test', '1.0.0')
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(LLMSchemaValidationError)
      const err = e as LLMSchemaValidationError
      expect(err.issues.some((i) => i.field === 'total')).toBe(true)
    }
  })

  it('throws for invalid enum value', () => {
    try {
      validateInput(schema, { order: 'Dress', lang: 'fr', total: 100 }, 'test', '1.0.0')
      expect.fail('should have thrown')
    } catch (e) {
      const err = e as LLMSchemaValidationError
      expect(err.issues.some((i) => i.field === 'lang')).toBe(true)
    }
  })

  it('reports multiple failing fields at once', () => {
    try {
      validateInput(schema, { order: 123, lang: 'fr', total: -10 }, 'test', '1.0.0')
      expect.fail('should have thrown')
    } catch (e) {
      const err = e as LLMSchemaValidationError
      expect(err.issues.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('formats nested paths correctly', () => {
    const nestedSchema = z.object({
      address: z.object({
        city: z.string(),
        zip: z.number(),
      }),
    })

    try {
      validateInput(nestedSchema, { address: { city: 123, zip: 'abc' } }, 'test', '1.0.0')
      expect.fail('should have thrown')
    } catch (e) {
      const err = e as LLMSchemaValidationError
      expect(err.issues.some((i) => i.field === 'address.city')).toBe(true)
      expect(err.issues.some((i) => i.field === 'address.zip')).toBe(true)
    }
  })

  it('includes prompt name and version in error', () => {
    try {
      validateInput(schema, {}, 'order-assistant', '2.1.0')
      expect.fail('should have thrown')
    } catch (e) {
      const err = e as LLMSchemaValidationError
      expect(err.promptName).toBe('order-assistant')
      expect(err.promptVersion).toBe('2.1.0')
      expect(err.message).toContain('order-assistant')
      expect(err.message).toContain('2.1.0')
    }
  })
})

describe('schemaToJsonSchema', () => {
  it('converts z.string() to { "type": "string" }', () => {
    const result = schemaToJsonSchema(z.string())
    expect(result).toEqual({ type: 'string' })
  })

  it('converts z.number().positive() with exclusiveMinimum', () => {
    const result = schemaToJsonSchema(z.number().positive())
    expect(result).toEqual({ type: 'number', exclusiveMinimum: 0 })
  })

  it('converts z.enum() to enum array', () => {
    const result = schemaToJsonSchema(z.enum(['es', 'en']))
    expect(result).toEqual({ type: 'string', enum: ['es', 'en'] })
  })

  it('converts z.boolean() to { "type": "boolean" }', () => {
    const result = schemaToJsonSchema(z.boolean())
    expect(result).toEqual({ type: 'boolean' })
  })

  it('converts z.object() with required and optional fields', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    })
    const result = schemaToJsonSchema(schema) as Record<string, unknown>

    expect(result.type).toBe('object')
    expect(result.required).toEqual(['name'])
    expect((result.properties as Record<string, unknown>).name).toEqual({ type: 'string' })
  })

  it('converts z.object().strict() with additionalProperties: false', () => {
    const schema = z.object({ name: z.string() }).strict()
    const result = schemaToJsonSchema(schema) as Record<string, unknown>
    expect(result.additionalProperties).toBe(false)
  })

  it('converts z.array(z.string())', () => {
    const result = schemaToJsonSchema(z.array(z.string()))
    expect(result).toEqual({ type: 'array', items: { type: 'string' } })
  })
})
