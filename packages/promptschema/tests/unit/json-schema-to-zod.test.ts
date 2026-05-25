import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { jsonSchemaToZod } from '../../src/json-schema-to-zod.js'
import { schemaToJsonSchema } from '../../src/schema.js'
import { LLMSchemaError } from '../../src/errors.js'

describe('jsonSchemaToZod', () => {
  it('converts string type', () => {
    const zod = jsonSchemaToZod({ type: 'string' })
    expect(zod.parse('hello')).toBe('hello')
    expect(() => zod.parse(123)).toThrow()
  })

  it('converts string with minLength', () => {
    const zod = jsonSchemaToZod({ type: 'string', minLength: 3 })
    expect(zod.parse('hello')).toBe('hello')
    expect(() => zod.parse('ab')).toThrow()
  })

  it('converts number type', () => {
    const zod = jsonSchemaToZod({ type: 'number' })
    expect(zod.parse(42)).toBe(42)
    expect(zod.parse(3.14)).toBe(3.14)
    expect(() => zod.parse('abc')).toThrow()
  })

  it('converts number with exclusiveMinimum (positive)', () => {
    const zod = jsonSchemaToZod({ type: 'number', exclusiveMinimum: 0 })
    expect(zod.parse(1)).toBe(1)
    expect(() => zod.parse(0)).toThrow()
    expect(() => zod.parse(-5)).toThrow()
  })

  it('converts number with minimum and maximum', () => {
    const zod = jsonSchemaToZod({ type: 'number', minimum: 0, maximum: 100 })
    expect(zod.parse(0)).toBe(0)
    expect(zod.parse(100)).toBe(100)
    expect(() => zod.parse(-1)).toThrow()
    expect(() => zod.parse(101)).toThrow()
  })

  it('converts integer type', () => {
    const zod = jsonSchemaToZod({ type: 'integer' })
    expect(zod.parse(42)).toBe(42)
    expect(() => zod.parse(3.14)).toThrow()
  })

  it('converts boolean type', () => {
    const zod = jsonSchemaToZod({ type: 'boolean' })
    expect(zod.parse(true)).toBe(true)
    expect(() => zod.parse('true')).toThrow()
  })

  it('converts enum', () => {
    const zod = jsonSchemaToZod({ enum: ['es', 'en', 'fr'] })
    expect(zod.parse('es')).toBe('es')
    expect(() => zod.parse('de')).toThrow()
  })

  it('converts array of strings', () => {
    const zod = jsonSchemaToZod({ type: 'array', items: { type: 'string' } })
    expect(zod.parse(['a', 'b'])).toEqual(['a', 'b'])
    expect(() => zod.parse([1, 2])).toThrow()
  })

  it('converts object with required and optional fields', () => {
    const zod = jsonSchemaToZod({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        active: { type: 'boolean' },
      },
      required: ['name', 'age'],
    })

    expect(zod.parse({ name: 'Oscar', age: 30 })).toEqual({ name: 'Oscar', age: 30 })
    expect(zod.parse({ name: 'Oscar', age: 30, active: true })).toEqual({
      name: 'Oscar',
      age: 30,
      active: true,
    })
    expect(() => zod.parse({ name: 'Oscar' })).toThrow()
  })

  it('converts strict object (additionalProperties: false)', () => {
    const zod = jsonSchemaToZod({
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
      additionalProperties: false,
    })

    expect(zod.parse({ name: 'Oscar' })).toEqual({ name: 'Oscar' })
    expect(() => zod.parse({ name: 'Oscar', extra: true })).toThrow()
  })

  it('throws on unsupported type', () => {
    expect(() => jsonSchemaToZod({ type: 'null' })).toThrow(LLMSchemaError)
  })

  it('throws on missing type field', () => {
    expect(() => jsonSchemaToZod({})).toThrow(LLMSchemaError)
  })

  it('round-trip: Zod → JSON Schema → Zod produces equivalent validation', () => {
    const original = z.object({
      order: z.string(),
      lang: z.enum(['es', 'en']),
      total: z.number(),
      discount: z.boolean().optional(),
    })

    const jsonSchema = schemaToJsonSchema(original) as Record<string, unknown>
    const reconstructed = jsonSchemaToZod(jsonSchema)

    const validInput = { order: 'Dress', lang: 'en', total: 149 }
    expect(reconstructed.parse(validInput)).toEqual(original.parse(validInput))

    const validWithOptional = { order: 'Dress', lang: 'es', total: 50, discount: true }
    expect(reconstructed.parse(validWithOptional)).toEqual(original.parse(validWithOptional))

    expect(() => reconstructed.parse({ order: 'Dress' })).toThrow()
    expect(() => reconstructed.parse({ order: 'Dress', lang: 'fr', total: 10 })).toThrow()
  })
})
