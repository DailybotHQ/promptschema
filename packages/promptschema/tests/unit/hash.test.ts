import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { hashTemplate, hashSchema } from '../../src/versioning/hash.js'
import { normalizeWhitespace, stableStringify } from '../../src/versioning/hash.js'

describe('normalizeWhitespace', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeWhitespace('  hello  ')).toBe('hello')
  })

  it('collapses multiple spaces in each line', () => {
    expect(normalizeWhitespace('hello    world')).toBe('hello world')
  })

  it('collapses multiple newlines', () => {
    expect(normalizeWhitespace('a\n\n\nb')).toBe('a\nb')
  })

  it('removes leading whitespace from each line', () => {
    expect(normalizeWhitespace('  a\n    b\n  c')).toBe('a\nb\nc')
  })
})

describe('stableStringify', () => {
  it('sorts object keys deterministically', () => {
    const a = stableStringify({ b: 1, a: 2 })
    const b = stableStringify({ a: 2, b: 1 })
    expect(a).toBe(b)
  })

  it('handles nested objects', () => {
    const a = stableStringify({ z: { b: 1, a: 2 }, a: 3 })
    const b = stableStringify({ a: 3, z: { a: 2, b: 1 } })
    expect(a).toBe(b)
  })

  it('preserves arrays in order', () => {
    const result = stableStringify({ items: [3, 1, 2] })
    expect(result).toBe('{"items":[3,1,2]}')
  })
})

describe('hashTemplate', () => {
  it('returns an 8 hex character string', () => {
    const hash = hashTemplate((i: unknown) => `Hello ${i}`)
    expect(hash).toMatch(/^[0-9a-f]{8}$/)
  })

  it('is deterministic', () => {
    const fn = (i: { name: string }) => `Hello ${i.name}`
    expect(hashTemplate(fn)).toBe(hashTemplate(fn))
  })

  it('different templates produce different hashes', () => {
    const a = hashTemplate(() => 'Hello')
    const b = hashTemplate(() => 'Goodbye')
    expect(a).not.toBe(b)
  })

  it('same function with different surrounding whitespace produces the same hash', () => {
    const fn = () => 'Hello world'
    const hash1 = hashTemplate(fn)
    const hash2 = hashTemplate(fn)
    expect(hash1).toBe(hash2)
  })
})

describe('hashSchema', () => {
  it('returns an 8 hex character string', () => {
    const hash = hashSchema(z.object({ name: z.string() }))
    expect(hash).toMatch(/^[0-9a-f]{8}$/)
  })

  it('is deterministic', () => {
    const schema = z.object({ name: z.string(), age: z.number() })
    expect(hashSchema(schema)).toBe(hashSchema(schema))
  })

  it('different schemas produce different hashes', () => {
    const a = hashSchema(z.object({ name: z.string() }))
    const b = hashSchema(z.object({ age: z.number() }))
    expect(a).not.toBe(b)
  })

  it('same schema defined twice produces the same hash', () => {
    const a = hashSchema(z.object({ name: z.string(), age: z.number() }))
    const b = hashSchema(z.object({ name: z.string(), age: z.number() }))
    expect(a).toBe(b)
  })
})
